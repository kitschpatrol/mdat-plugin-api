import { expandString } from 'mdat'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import apiPlugin, { setLogger } from '../src'
import { fixture, generate } from './helpers'

const WHITESPACE_REGEX = /\s+/gv
const COMPACT_TABLE_HEADER_REGEX = /\| Function\s+\| Returns\s+\| Description\s+\|/v
const INVALID_HEADING_LEVEL_REGEX = /Invalid options.*headingLevel/sv
const UNRECOGNIZED_KEY_REGEX = /Invalid options.*Unrecognized key.*heading/sv
const INVALID_SORT_REGEX = /Invalid options.*sort/sv

function getContent(): (options: unknown) => Promise<string> {
	const rule = apiPlugin.api
	if (typeof rule !== 'object' || Array.isArray(rule) || typeof rule.content !== 'function') {
		throw new TypeError('Expected the api rule to be an object with a content function')
	}

	const { content } = rule
	return async (options) =>
		content(options as never, {
			filePath: undefined,
			frontmatter: undefined,
			tree: { children: [], type: 'root' },
		})
}

function createLoggerSpy() {
	return {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		log: vi.fn(),
		trace: vi.fn(),
		warn: vi.fn(),
	}
}

function calls(spy: ReturnType<typeof vi.fn>): string {
	return stripVTControlCharacters(spy.mock.calls.flat().map(String).join(' ')).replaceAll(
		WHITESPACE_REGEX,
		' ',
	)
}

afterEach(() => {
	setLogger()
})

describe('api rule', () => {
	it('expands the placeholder through mdat', async () => {
		const result = await expandString(
			'<!-- api({ entryPoint: "test/assets/fixtures/sample-lib.ts", format: "compact" }) -->',
			apiPlugin,
			{ format: false },
		)
		const output = String(result)
		expect(output).toMatch(COMPACT_TABLE_HEADER_REGEX)
		expect(output).toContain('<!-- /api -->')
		expect(result.messages.filter((message) => message.fatal)).toEqual([])
	})

	it('applies defaults', async () => {
		const markdown = await getContent()({ entryPoint: 'test/assets/fixtures/sample-lib.ts' })
		expect(markdown).toContain('### Functions')
		expect(markdown).toContain('#### greet()')
	})

	it('rejects invalid options with a readable message', async () => {
		const content = getContent()
		await expect(content({ headingLevel: 9 })).rejects.toThrow(INVALID_HEADING_LEVEL_REGEX)
		await expect(content({ heading: 2 })).rejects.toThrow(UNRECOGNIZED_KEY_REGEX)
		await expect(content({ sort: ['random'] })).rejects.toThrow(INVALID_SORT_REGEX)
		await expect(content('nope')).rejects.toThrow('Invalid options')
	})

	it('routes TypeDoc validation warnings to the debug log', async () => {
		const spy = createLoggerSpy()
		setLogger(spy)
		await generate(fixture('edge-cases.ts'))
		expect(calls(spy.debug)).toContain('GlobalOptions')
		expect(calls(spy.debug)).toContain('not included in the documentation')
		expect(calls(spy.warn)).toBe('')
		expect(calls(spy.error)).toBe('')
	})

	it('routes TypeDoc warnings and errors through the library logger', async () => {
		const spy = createLoggerSpy()
		setLogger(spy)
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdat-plugin-api-test-'))
		const entryPoint = path.join(directory, 'outside.ts')
		await fs.writeFile(entryPoint, 'export const outside = 1\n')

		try {
			// The file is outside the working directory's tsconfig, which TypeDoc
			// reports as a warning followed by an error
			await expect(generate(entryPoint)).rejects.toThrow('TypeDoc could not build a project')
			expect(calls(spy.warn)).toContain('not referenced by the')
			expect(calls(spy.error)).toContain('Unable to find any entry points')
		} finally {
			await fs.rm(directory, { force: true, recursive: true })
		}
	})

	it('warns about include patterns that match nothing', async () => {
		const spy = createLoggerSpy()
		setLogger(spy)
		await generate(fixture('sample-lib.ts'), { include: ['greet', 'nope*'] })
		expect(calls(spy.warn)).toContain('"nope*" did not match any top-level export')
	})
})
