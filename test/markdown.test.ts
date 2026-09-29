import { describe, expect, it } from 'vitest'
import {
	codeSpan,
	collapseBlankLines,
	dedentCodeBlock,
	demoteOverflowHeadings,
	escapeTableCell,
	mapLinesOutsideFences,
	shiftHeadings,
	slugify,
} from '../src/utilities/markdown'

describe('shiftHeadings', () => {
	it('shifts every heading so the shallowest lands on the target level', () => {
		expect(shiftHeadings('## A\n\n### B\n\ntext', 4)).toBe('#### A\n\n##### B\n\ntext')
	})

	it('shifts up as well as down', () => {
		expect(shiftHeadings('### A\n#### B', 1)).toBe('# A\n## B')
	})

	it('ignores heading-like lines inside fenced code', () => {
		const markdown = '## A\n\n```sh\n# not a heading\n```\n\n~~~\n## nor this\n~~~'
		expect(shiftHeadings(markdown, 3)).toBe(
			'### A\n\n```sh\n# not a heading\n```\n\n~~~\n## nor this\n~~~',
		)
	})

	it('leaves text without headings alone', () => {
		expect(shiftHeadings('just text', 2)).toBe('just text')
	})
})

describe('demoteOverflowHeadings', () => {
	it('renders headings deeper than six as bold text', () => {
		expect(demoteOverflowHeadings('###### Six\n\n####### Seven\n\n######## Eight')).toBe(
			'###### Six\n\n**Seven**\n\n**Eight**',
		)
	})
})

describe('collapseBlankLines', () => {
	it('collapses runs of blank lines outside code fences', () => {
		expect(collapseBlankLines('a\n\n\n\nb\n\n```\nc\n\n\n\nd\n```')).toBe(
			'a\n\nb\n\n```\nc\n\n\n\nd\n```',
		)
	})
})

describe('slugify', () => {
	it('matches GitHub heading anchors', () => {
		expect(slugify('things.list()')).toBe('thingslist')
		expect(slugify('MAX_GREETING_LENGTH')).toBe('max_greeting_length')
		expect(slugify('Factory<T>')).toBe('factoryt')
		expect(slugify('Type Aliases')).toBe('type-aliases')
	})
})

describe('escapeTableCell', () => {
	it('escapes pipes and joins lines', () => {
		expect(escapeTableCell('a | b')).toBe(String.raw`a \| b`)
		expect(escapeTableCell('line one\n  line two ')).toBe('line one line two')
	})
})

describe('codeSpan', () => {
	it('picks a delimiter longer than any backtick run inside', () => {
		expect(codeSpan('x')).toBe('`x`')
		expect(codeSpan('a`b')).toBe('``a`b``')
		expect(codeSpan('`x`')).toBe('`` `x` ``')
	})
})

describe('dedentCodeBlock', () => {
	it('removes the indent TypeDoc leaves on every line after the first', () => {
		expect(dedentCodeBlock('```ts\nconst a = 1\n\tconst b = 2\n\tconst c = 3\n```')).toBe(
			'```ts\nconst a = 1\nconst b = 2\nconst c = 3\n```',
		)
	})

	it('preserves relative indentation', () => {
		expect(dedentCodeBlock('```ts\nfoo(() => {\n\t\tbar()\n\t})\n```')).toBe(
			'```ts\nfoo(() => {\n\tbar()\n})\n```',
		)
	})

	it('ignores blank lines when measuring the indent', () => {
		expect(dedentCodeBlock('```ts\na\n\n\tb\n```')).toBe('```ts\na\n\nb\n```')
	})

	it('leaves blocks without a shared indent alone', () => {
		const block = '```ts\nfoo(\n  a,\n)\n```'
		expect(dedentCodeBlock(block)).toBe(block)
	})

	it('leaves single-line blocks alone', () => {
		expect(dedentCodeBlock('```ts\nconst a = 1\n```')).toBe('```ts\nconst a = 1\n```')
	})
})

describe('mapLinesOutsideFences', () => {
	it('drops lines when the transform returns undefined', () => {
		expect(mapLinesOutsideFences('a\nb\nc', (line) => (line === 'b' ? undefined : line))).toBe(
			'a\nc',
		)
	})

	it('treats a longer closing fence as closing', () => {
		const markdown = '````\nx\n```\ny\n````\nz'
		expect(mapLinesOutsideFences(markdown, (line) => line.toUpperCase())).toBe(
			'````\nx\n```\ny\n````\nZ',
		)
	})
})
