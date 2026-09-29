import type { Application, ProjectReflection } from 'typedoc'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ClassifiedLine } from './markdown'
import { log } from './log'
import {
	classifyLines,
	collapseBlankLines,
	mapLinesOutsideFences,
	shiftHeadings,
	slugify,
} from './markdown'
import { ENTRY_FILE_NAME } from './typedoc-project'

/**
 * Options for the full renderer.
 */
export type FullOptions = {
	/** Whether TypeDoc rendered group headings above members. */
	groupByKind: boolean
	/** Heading level for the shallowest headings in the output. */
	headingLevel: number
	/** Directory that TypeDoc renders pages into. */
	outputDirectory: string
}

// An index entry linking to a namespace page, e.g. `- [things](Namespace.things.md)`
const INDEX_ITEM_REGEX = /^- \[(?<name>[^\]]+)\]\((?<file>[^\)#]+\.md)\)$/v
// Any link to a page, with an optional anchor
const PAGE_LINK_REGEX = /\]\((?<file>[^\)#\s]+\.md)(?<anchor>#[^\)]*)?\)/gv
// Anchors typedoc-plugin-markdown emits in property table cells
const HTML_ANCHOR_REGEX = /<a id="[^"]*"><\/a>\s*/gv
const HORIZONTAL_RULE_REGEX = /^\*\*\*$/v
const HEADING_REGEX = /^#+ /v
const SCAFFOLDING_HEADING_REGEX = /^#+ (?<title>Parameters|Type Parameters|Returns)$/v
const NESTED_PARAMETER_ROW_REGEX = /^\| `[^`]*\./v

/**
 * Render the project with typedoc-plugin-markdown, then fold the pages it
 * writes into a single Markdown document. TypeDoc gives every namespace its own
 * page and links to it from an index in the parent page. Each index entry is
 * replaced with the namespace's page, so cross-page links become in-document
 * anchors.
 */
export async function renderFull(
	app: Application,
	project: ProjectReflection,
	options: FullOptions,
): Promise<string> {
	const { groupByKind, headingLevel, outputDirectory } = options

	await app.generateOutputs(project)
	const pages = await readPages(outputDirectory)
	const entryFile = `${ENTRY_FILE_NAME}.md`
	const entryPage = pages.get(entryFile)

	if (entryPage === undefined) {
		throw new Error(
			`TypeDoc did not write the expected entry page ${entryFile} to ${outputDirectory}. Pages written: ${pages.keys().toArray().join(', ')}`,
		)
	}

	// With page titles hidden, TypeDoc renders group headings at level 2 and
	// members at level 3, or members at level 2 when group headings are hidden
	const memberLevel = groupByKind ? 3 : 2
	const pageAnchors = new Map<string, string>()
	let markdown = inlineNamespacePages(entryPage, pages, memberLevel, pageAnchors)

	markdown = mapLinesOutsideFences(markdown, (line) =>
		line.replaceAll(PAGE_LINK_REGEX, (match, file: string, anchor: string | undefined) => {
			if (!pages.has(file)) {
				return match
			}

			if (anchor !== undefined) {
				return `](${anchor})`
			}

			const pageAnchor = pageAnchors.get(file)
			if (pageAnchor !== undefined) {
				return `](#${pageAnchor})`
			}

			log.warn(`Could not resolve a link to the page ${file}, leaving it as plain text`)
			return match
		}),
	)

	markdown = mapLinesOutsideFences(markdown, (line) =>
		HORIZONTAL_RULE_REGEX.test(line) ? undefined : line.replaceAll(HTML_ANCHOR_REGEX, ''),
	)

	markdown = removeUndocumentedScaffolding(markdown)
	markdown = shiftHeadings(markdown, headingLevel)
	return collapseBlankLines(markdown).trim()
}

/**
 * Signatures are rendered with parameter and return types, so a Parameters
 * table without descriptions, a Type Parameters table without constraints, or a
 * Returns section that only repeats the type add nothing. Drop them.
 */
function removeUndocumentedScaffolding(markdown: string): string {
	const lines = classifyLines(markdown)
	const output: string[] = []
	let index = 0

	while (index < lines.length) {
		const current = lines[index]
		if (current === undefined) {
			break
		}

		const title = current.isCode
			? undefined
			: SCAFFOLDING_HEADING_REGEX.exec(current.line)?.groups?.title

		if (title !== undefined) {
			const end = findSectionEnd(lines, index + 1)
			const body = lines
				.slice(index + 1, end)
				.map(({ line }) => line)
				.filter((line) => line.trim() !== '')

			if (isUndocumented(title, body)) {
				index = end
				continue
			}
		}

		output.push(current.line)
		index++
	}

	return output.join('\n')
}

function findSectionEnd(lines: ClassifiedLine[], start: number): number {
	let end = start
	while (end < lines.length) {
		const next = lines[end]
		if (next !== undefined && !next.isCode && HEADING_REGEX.test(next.line)) {
			return end
		}

		end++
	}

	return end
}

function isUndocumented(title: string, body: string[]): boolean {
	switch (title) {
		case 'Parameters': {
			// Rows like `options.name` spell out an object parameter that the
			// signature only shows as `object`, so keep those tables
			return (
				body[0] === '| Parameter | Type |' &&
				body.every((line) => line.startsWith('|')) &&
				body.every((line) => !NESTED_PARAMETER_ROW_REGEX.test(line))
			)
		}

		case 'Returns': {
			return body.length === 1
		}

		case 'Type Parameters': {
			return body[0] === '| Type Parameter |' && body.every((line) => line.startsWith('|'))
		}

		default: {
			return false
		}
	}
}

async function readPages(directory: string): Promise<Map<string, string>> {
	const pages = new Map<string, string>()

	const files = await fs.readdir(directory)
	for (const file of files) {
		if (file.endsWith('.md')) {
			pages.set(file, await fs.readFile(path.join(directory, file), 'utf8'))
		}
	}

	log.debug(`TypeDoc wrote ${String(pages.size)} pages: ${pages.keys().toArray().join(', ')}`)
	return pages
}

function inlineNamespacePages(
	page: string,
	pages: Map<string, string>,
	memberLevel: number,
	pageAnchors: Map<string, string>,
): string {
	return mapLinesOutsideFences(page, (line) => {
		const match = INDEX_ITEM_REGEX.exec(line)
		const name = match?.groups?.name
		const file = match?.groups?.file
		const childPage = file === undefined ? undefined : pages.get(file)

		if (name === undefined || file === undefined || childPage === undefined) {
			return line
		}

		pageAnchors.set(file, slugify(name))
		const body = shiftHeadings(
			inlineNamespacePages(childPage, pages, memberLevel, pageAnchors),
			memberLevel + 1,
		)

		return `${'#'.repeat(memberLevel)} ${name}\n\n${body}`
	})
}
