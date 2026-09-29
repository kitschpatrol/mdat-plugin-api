import { beforeAll, describe, expect, it } from 'vitest'
import { fixture, generate, headings, inOrder } from './helpers'

const HORIZONTAL_RULE_REGEX = /^\*\*\*$/mv
const LEVEL_ONE_HEADING_REGEX = /^# /mv
const OVERLOAD_SIGNATURE_REGEX = /^> \*\*overloaded\*\*/gmv

describe('full format', () => {
	describe('sample library', () => {
		let markdown: string

		beforeAll(async () => {
			markdown = await generate(fixture('sample-lib.ts'))
		})

		it('matches the snapshot', () => {
			expect(markdown).toMatchSnapshot()
		})

		it('groups exports by kind, in source order within each group', () => {
			expect(headings(markdown).join('\n')).toMatch(
				inOrder([
					'### Functions',
					'#### greet()',
					'#### translate()',
					'#### hello()',
					'### Classes',
					'#### GreetingGenerator',
					'### Type Aliases',
					'#### GreetingOptions',
					'#### GreetingResult',
					'#### Language',
					'### Variables',
					String.raw`#### MAX\_GREETING\_LENGTH`,
				]),
			)
		})

		it('documents the default export under its declared name', () => {
			expect(markdown).toContain('#### hello()')
			expect(markdown).toContain('> **hello**(')
			expect(markdown).not.toContain('default(')
			expect(markdown).not.toContain('**default**')
		})

		it('removes the stray indent from examples written in the indented JSDoc style', () => {
			expect(markdown).toContain("const result = greet('World')\nconsole.log(result.message)")
			expect(markdown).not.toContain('\tconsole.log')
		})

		it('links type references to headings in the same document', () => {
			expect(markdown).toContain('[`GreetingResult`](#greetingresult)')
			expect(markdown).not.toContain('.md)')
		})

		it('drops source locations, horizontal rules, and table anchors', () => {
			expect(markdown).not.toContain('Defined in')
			expect(markdown).not.toMatch(HORIZONTAL_RULE_REGEX)
			expect(markdown).not.toContain('<a id=')
		})
	})

	it('starts headings at the requested level', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), { headingLevel: 2 })
		expect(headings(markdown)[0]).toBe('## Functions')
		expect(markdown).not.toMatch(LEVEL_ONE_HEADING_REGEX)
	})

	it('renders headings that would exceed level six as bold text', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), { headingLevel: 6 })
		expect(headings(markdown)).toEqual([
			'###### Functions',
			'###### Classes',
			'###### Type Aliases',
			'###### Variables',
		])
		expect(markdown).toContain('**greet()**')
		expect(markdown).toContain('**Parameters**')
	})

	it('lists exports flat in source order without kind groups', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), { groupByKind: false })
		expect(markdown).not.toContain('### Functions')
		expect(headings(markdown).filter((heading) => heading.startsWith('### '))).toEqual([
			'### GreetingOptions',
			'### GreetingResult',
			'### Language',
			'### greet()',
			'### translate()',
			String.raw`### MAX\_GREETING\_LENGTH`,
			'### hello()',
			'### GreetingGenerator',
		])
	})

	it('sorts alphabetically when asked', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), {
			groupByKind: false,
			sort: ['alphabetical'],
		})
		expect(headings(markdown).filter((heading) => heading.startsWith('### '))).toEqual([
			'### greet()',
			'### GreetingGenerator',
			'### GreetingOptions',
			'### GreetingResult',
			'### hello()',
			'### Language',
			String.raw`### MAX\_GREETING\_LENGTH`,
			'### translate()',
		])
	})

	it('keeps only included exports', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), { include: ['greet', '*Result'] })
		expect(headings(markdown)).toEqual([
			'### Functions',
			'#### greet()',
			'##### Parameters',
			'##### Returns',
			'##### Examples',
			'### Type Aliases',
			'#### GreetingResult',
			'##### Properties',
		])
		// Links to excluded types degrade to plain text
		expect(markdown).toContain('`GreetingOptions`')
		expect(markdown).not.toContain('(#greetingoptions)')
	})

	it('drops excluded exports', async () => {
		const markdown = await generate(fixture('sample-lib.ts'), { exclude: ['Greeting*', 'hello'] })
		expect(headings(markdown).filter((heading) => heading.startsWith('#### '))).toEqual([
			'#### greet()',
			'#### translate()',
			'#### Language',
			String.raw`#### MAX\_GREETING\_LENGTH`,
		])
	})

	describe('namespaces', () => {
		let markdown: string

		beforeAll(async () => {
			markdown = await generate(fixture('namespaces/index.ts'))
		})

		it('matches the snapshot', () => {
			expect(markdown).toMatchSnapshot()
		})

		it('folds namespace pages in under qualified headings', () => {
			expect(markdown).toMatch(
				inOrder([
					'### Functions',
					'#### list()',
					'#### describe()',
					'### Namespaces',
					'#### things',
					'##### Functions',
					'###### things.list()',
					'###### things.add()',
					'##### Type Aliases',
					'###### things.ThingOptions',
					'##### Namespaces',
					'###### things.nested',
					'**things.nested.count()**',
					'**things.nested.list()**',
				]),
			)
		})

		it('rewrites links between pages to in-document anchors', () => {
			expect(markdown).toContain('[`things.ThingOptions`](#thingsthingoptions)')
			expect(markdown).not.toContain('.md')
		})
	})

	describe('edge cases', () => {
		let markdown: string

		beforeAll(async () => {
			markdown = await generate(fixture('edge-cases.ts'))
		})

		it('matches the snapshot', () => {
			expect(markdown).toMatchSnapshot()
		})

		it('documents undocumented exports and overloads', () => {
			expect(markdown).toContain('#### undocumented()')
			expect(markdown.match(OVERLOAD_SIGNATURE_REGEX)).toHaveLength(2)
		})

		it('drops parameter and return sections that only repeat the signature', () => {
			expect(markdown).toContain(
				'#### undocumented()\n\n> **undocumented**(`a`: `string`, `b?`: `number`): `boolean`\n\n#### overloaded()',
			)
			expect(markdown).not.toContain('| Parameter | Type |\n| ------ | ------ |\n| `a`')
		})

		it('keeps parameter tables that spell out object parameters', () => {
			expect(markdown).toContain('> **configure**(`options`: `object`): `string`')
			expect(markdown).toContain('| `options.nested.deep` | `boolean` |')
		})

		it('shows aliases of unexported types as written', () => {
			expect(markdown).toContain('`Pick`\\<`GlobalOptions`')
		})
	})

	it('names a default export that re-exports a binding after that binding', async () => {
		const markdown = await generate(fixture('default-alias.ts'))
		expect(headings(markdown)).toContain('#### plugin')
		expect(markdown).toContain('> `const` **plugin**')
		expect(headings(markdown)).not.toContain('#### default')
	})

	it('throws when the entry point has no exports', async () => {
		await expect(generate(fixture('empty.ts'))).rejects.toThrow('No public API exports found')
	})

	describe('tsconfig option', () => {
		const entryPoint = fixture('project/src/index.ts')

		it('uses the nearest tsconfig by default', async () => {
			const markdown = await generate(entryPoint)
			expect(markdown).toContain('#### documented()')
			expect(markdown).toContain('#### undocumented()')
		})

		it('honors a custom tsconfig', async () => {
			const markdown = await generate(entryPoint, {
				tsconfig: fixture('project/tsconfig.docs.json'),
			})
			expect(markdown).toContain('#### documented()')
			expect(markdown).not.toContain('#### undocumented()')
		})

		it('throws when the tsconfig is missing', async () => {
			await expect(
				generate(entryPoint, { tsconfig: fixture('project/tsconfig.missing.json') }),
			).rejects.toThrow('tsconfig file was not found')
		})
	})
})
