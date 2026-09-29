import { beforeAll, describe, expect, it } from 'vitest'
import { fixture, generate, headings } from './helpers'

describe('compact format', () => {
	describe('sample library', () => {
		let markdown: string

		beforeAll(async () => {
			markdown = await generate(fixture('sample-lib.ts'), { format: 'compact' })
		})

		it('matches the snapshot', () => {
			expect(markdown).toMatchSnapshot()
		})

		it('renders one table per kind', () => {
			expect(headings(markdown)).toEqual([
				'### Functions',
				'### Classes',
				'### Type Aliases',
				'### Variables',
			])
			expect(markdown).toContain('| Function | Returns | Description |')
			expect(markdown).toContain('| Class | Constructor | Description |')
		})

		it('renders signatures with parameter types and return types', () => {
			expect(markdown).toContain(
				'| `greet(name: string, options?: GreetingOptions)` | `GreetingResult` | Generate a personalized greeting. |',
			)
			expect(markdown).toContain(
				'| `GreetingGenerator` | `new GreetingGenerator(language?: Language)` | A greeting generator that maintains state. |',
			)
		})

		it('expands object types one level deep and escapes pipes in unions', () => {
			expect(markdown).toContain('`{ formal?: boolean; maxLength?: number }`')
			expect(markdown).toContain(String.raw`"en" \| "es" \| "fr" \| "ja"`)
		})

		it('uses the declared name for the default export', () => {
			expect(markdown).toContain('| `hello(name: string)` | `string` |')
		})
	})

	it('renders a single table without kind groups', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), {
			format: 'compact',
			groupByKind: false,
		})
		expect(headings(markdown)).toEqual([])
		expect(markdown).toContain('| Export | Type | Description |')
		expect(markdown.split('\n')).toHaveLength(2 + 8)
	})

	it('renders namespaces as nested sections', async () => {
		const markdown = await generate(fixture('namespaces/index.ts'), { format: 'compact' })
		expect(markdown).toMatchSnapshot()
		expect(headings(markdown)).toEqual([
			'### Functions',
			'### things',
			'#### Functions',
			'#### Type Aliases',
			'#### things.nested',
			'##### Functions',
		])
		expect(markdown).toContain('Things you can list and add.')
		expect(markdown).toContain('| `list(options?: ThingOptions)` | `string[]` | List things. |')
	})

	it('handles edge cases', async () => {
		const markdown = await generate(fixture('edge-cases.ts'), { format: 'compact' })
		expect(markdown).toMatchSnapshot()
		expect(markdown).toContain(
			'| `overloaded(value: string)` | `string` | Overloaded for strings. |',
		)
		expect(markdown).toContain(
			'| `overloaded(value: number)` | `number` | Overloaded for numbers. |',
		)
		expect(markdown).toContain(
			'| `configure(options: { name: string; nested: object; onChange?: (value: number) => void })` | `string` |',
		)
		expect(markdown).toContain('| `undocumented(a: string, b?: number)` | `boolean` |  |')
		expect(markdown).toContain('| `shout(text: string)` | `string` | A function-typed variable. |')
		expect(markdown).toContain(
			'| `Adapter` | `{ name: string; read(path: string): Promise<string>; write?(path: string, content: string): Promise<void> }` |',
		)
	})

	it('summarizes nested object types as object', async () => {
		const markdown = await generate(fixture('edge-cases.ts'), { format: 'compact' })
		expect(markdown).toContain('| `deep()` | `Promise<{ items: object[]; meta: object }>` |')
		expect(markdown).toContain('| `Quoted` | `{ "file name": string }` |')
	})
})
