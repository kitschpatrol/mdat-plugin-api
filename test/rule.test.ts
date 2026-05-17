import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getApiMarkdown } from '../src/utilities/get-api-markdown'
import { resolveEntryPoint } from '../src/utilities/resolve-entry-point'

const importMetaDirname = path.dirname(fileURLToPath(import.meta.url))
const sampleLibPath = path.join(importMetaDirname, 'assets/fixtures/sample-lib.ts')

describe('resolve entry point', () => {
	it('should resolve an explicit entry point', async () => {
		const result = await resolveEntryPoint(sampleLibPath)
		expect(result).toBe(sampleLibPath)
	})

	it('should throw for a non-existent explicit entry point', async () => {
		await expect(resolveEntryPoint('/nonexistent/file.ts')).rejects.toThrow(
			'Explicit entry point not found',
		)
	})
})

describe('get api markdown', () => {
	it('should generate markdown from a TypeScript file', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toBeTruthy()
		expect(markdown.length).toBeGreaterThan(0)
	})

	it('should include function signatures', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toContain('greet')
		expect(markdown).toContain('translate')
	})

	it('should include type definitions', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toContain('GreetingOptions')
		expect(markdown).toContain('GreetingResult')
		expect(markdown).toContain('Language')
	})

	it('should include class documentation', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toContain('GreetingGenerator')
	})

	it('should include JSDoc descriptions', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toContain('Generate a personalized greeting')
	})

	it('should include @example code blocks', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toContain("greet('World')")
	})

	it('should include exported constants', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		// Underscores are escaped in markdown output
		expect(markdown).toContain(String.raw`MAX\_GREETING\_LENGTH`)
	})

	it('should respect heading level option', async () => {
		const h2 = await getApiMarkdown(sampleLibPath, 2)
		const h4 = await getApiMarkdown(sampleLibPath, 4)

		// H2 output should have ## as minimum heading
		expect(h2).toMatch(/^## /m)
		expect(h2).not.toMatch(/^# /m)

		// H4 output should have #### as minimum heading
		expect(h4).toMatch(/^#### /m)
		expect(h4).not.toMatch(/^#{1,3} /m)
	})

	it('should produce a complete snapshot', async () => {
		const markdown = await getApiMarkdown(sampleLibPath, 3)
		expect(markdown).toMatchSnapshot()
	})
})

describe('self-documentation', () => {
	const pluginEntryPoint = path.resolve(importMetaDirname, '../src/index.ts')

	it('should generate docs for the plugin itself with named types', async () => {
		const markdown = await getApiMarkdown(pluginEntryPoint, 3)
		expect(markdown).toContain('ApiRuleOptions')
		expect(markdown).toContain('entryPoint')
		expect(markdown).toContain('headingLevel')
		expect(markdown).toMatchSnapshot()
	})
})
