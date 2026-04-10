/* eslint-disable unicorn/no-array-reduce */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import cliHelpPlugin from '../src'
import { getHelpMarkdown, renderHelpMarkdownBasic } from '../src/utilities/get-help-markdown'
import { helpObjectToMarkdown } from '../src/utilities/help-object-to-markdown'
import { helpStringToObject } from '../src/utilities/help-string-to-object'

const cliHelpRule = cliHelpPlugin['cli-help']

const importMetaDirname = path.dirname(fileURLToPath(import.meta.url))

// Load all --help command output samples in ./assets/help-supported
const helpSamplesSupported = fs
	.readdirSync(`${importMetaDirname}/assets/help-supported`)
	.filter((file) => file.endsWith('.txt'))
	.reduce<Record<string, string>>((acc, file) => {
		const name = path.basename(file, '.txt')
		const content = fs.readFileSync(`${importMetaDirname}/assets/help-supported/${file}`, 'utf8')
		return { ...acc, [name]: content }
	}, {})

// These samples should just pass through to raw output, because we can't parse them
const unsupportedDirectory = `${importMetaDirname}/assets/help-unsupported`
const helpSamplesUnsupported = fs.existsSync(unsupportedDirectory)
	? fs
			.readdirSync(unsupportedDirectory)
			.filter((file) => file.endsWith('.txt'))
			.reduce<Record<string, string>>((acc, file) => {
				const name = path.basename(file, '.txt')
				const content = fs.readFileSync(`${unsupportedDirectory}/${file}`, 'utf8')
				return { ...acc, [name]: content }
			}, {})
	: {}

describe('cli help string to object', () => {
	for (const [name, helpText] of Object.entries(helpSamplesSupported)) {
		it(`should convert "${name}" to a valid program info object`, () => {
			const object = helpStringToObject(helpText)
			expect(object).toBeDefined()
			expect(object).toMatchSnapshot()
		})
	}
})

describe('cli help object to markdown', () => {
	for (const [name, helpText] of Object.entries(helpSamplesSupported)) {
		it(`should convert a help object or "${name}" to valid markdown`, () => {
			const object = helpStringToObject(helpText)
			expect(object).toBeDefined()
			const markdown = helpObjectToMarkdown(object!)
			expect(markdown).toMatchSnapshot()
		})
	}
})

describe('cli help fall back on unparsable output', () => {
	const unsupportedEntries = Object.entries(helpSamplesUnsupported)

	if (unsupportedEntries.length === 0) {
		it('no unsupported samples to test (all formats now supported)', () => {
			expect(true).toBe(true)
		})
	}

	for (const [name, helpText] of unsupportedEntries) {
		it(`should fall back to the basic code block since "${name}" cannot yet be parsed`, () => {
			// Attempt to parse typical Yargs help output
			const programInfo = helpStringToObject(helpText)

			expect(programInfo).toBeUndefined()

			// Fall back to basic code fence output if parsing fails
			const markdown = renderHelpMarkdownBasic(helpText)
			expect(markdown).toMatchSnapshot()
		})
	}
})

describe('cli help invocation', { timeout: 60_000 }, () => {
	it('should get help Markdown directly from the output of a command', async () => {
		const helpMarkdown = await getHelpMarkdown(`${importMetaDirname}/assets/cli.js`)
		expect(helpMarkdown).toMatchSnapshot()
	})

	it('should fall back to a basic code block if the help output cannot be parsed', async () => {
		const helpMarkdown = await getHelpMarkdown('git')
		expect(helpMarkdown).toContain('```')
		expect(helpMarkdown).toContain('usage: git')
	})

	// Skipping this test for now since this package doesn't export a binary
	it.skip('should try to infer the binary to get help from based on package.json', async () => {
		// TODO figure this out
		// @ts-expect-error - Types not narrowing...
		// eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-call
		const helpMarkdown = await cliHelpRule.content()
		expect(helpMarkdown).toMatchSnapshot()
	})

	it('should correctly identify executables', async () => {
		// TODO figure this out
		// @ts-expect-error - Types not narrowing...
		// eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-call
		const helpMarkdown = await cliHelpRule.content({ cliCommand: 'git' })
		expect(helpMarkdown).toContain('```')
		expect(helpMarkdown).toContain('usage: git')
	})

	it('should correctly identify non-executables', async () => {
		// TODO figure this out
		// @ts-expect-error - Types not narrowing...
		// eslint-disable-next-line ts/no-unsafe-call
		await expect(cliHelpRule.content({ cliCommand: '/dev/null' })).rejects.toThrow()
	})

	it('should correctly resolve binary names that are in package.json but not on the path', async () => {
		// TODO figure this out
		// @ts-expect-error - Types not narrowing...
		// eslint-disable-next-line ts/no-unsafe-assignment, ts/no-unsafe-call
		const helpMarkdown = await cliHelpRule.content({ cliCommand: 'mdat' })
		expect(helpMarkdown).toMatchSnapshot()
	})
})
