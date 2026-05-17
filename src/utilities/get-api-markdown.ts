import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Application } from 'typedoc'
import { log } from './log'

const HEADING_REGEX = /^(#{1,6})\s/gm
const PAGE_HEADER_REGEX = /^\[.*?\]\(.*?\)\s*\/\s*/gm
const NAV_LINK_REGEX = /^(?:---\n)?(?:\*\*\*\n)?(?:Defined in:.*\n?)?$/gm
// Match markdown links pointing to local .md files and replace with just the link text
const LOCAL_MD_LINK_REGEX = /\[([^\]]+)\]\([^)]*\.md\)/g
// Match HTML anchor tags used as property anchors
const HTML_ANCHOR_REGEX = /<a id="[^"]*"><\/a>\s*/g

/**
 * Generate markdown API documentation from TypeScript source files.
 *
 * @param entryPoint - Path to the TypeScript entry point file
 * @param headingLevel - Starting heading level (1-6)
 * @param tsconfig - Path to tsconfig.json
 * @returns Formatted markdown string
 */
export async function getApiMarkdown(
	entryPoint: string,
	headingLevel: number,
	tsconfig?: string,
): Promise<string> {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mdat-api-'))

	try {
		log.debug(`Generating API docs from: ${entryPoint}`)
		log.debug(`Output to temp dir: ${tmpDir}`)

		const app = await Application.bootstrapWithPlugins({
			entryPoints: [entryPoint],
			exclude: ['**/node_modules/**'],
			excludePrivate: true,
			excludeProtected: true,
			hideGenerator: true,
			out: tmpDir,
			plugin: ['typedoc-plugin-markdown'],
			readme: 'none',
			skipErrorChecking: true,
			// TypeDoc-plugin-markdown options (passed through)
			...({
				classPropertiesFormat: 'table',
				flattenOutputFiles: true,
				hideBreadcrumbs: true,
				hidePageHeader: true,
				interfacePropertiesFormat: 'table',
				parametersFormat: 'table',
				propertyMembersFormat: 'table',
				typeAliasPropertiesFormat: 'table',
				typeDeclarationFormat: 'table',
			} as Record<string, unknown>),
			...(tsconfig ? { tsconfig } : {}),
		})

		const project = await app.convert()
		if (!project) {
			throw new Error(`TypeDoc failed to convert project from entry point: ${entryPoint}`)
		}

		await app.generateOutputs(project)

		const markdown = await readAndCombineOutput(tmpDir, headingLevel)

		if (markdown.trim().length === 0) {
			throw new Error(`No public API exports found in: ${entryPoint}`)
		}

		return markdown.trim()
	} finally {
		await fs.rm(tmpDir, { force: true, recursive: true })
	}
}

/**
 * Read all generated markdown files from the output directory and combine
 * into a single string with adjusted heading levels.
 */
async function readAndCombineOutput(outputDir: string, headingLevel: number): Promise<string> {
	const files = await fs.readdir(outputDir)
	const mdFiles = files
		.filter((f) => f.endsWith('.md'))
		// Skip the module index file (contains only links to other files)
		.filter((f) => !f.startsWith('README') && !f.startsWith('index'))
		.toSorted()

	log.debug(`Found ${String(mdFiles.length)} markdown files in output`)

	const sections: string[] = []

	for (const file of mdFiles) {
		const filePath = path.join(outputDir, file)
		const stat = await fs.stat(filePath)

		if (stat.isDirectory()) continue

		let content = await fs.readFile(filePath, 'utf8')

		// Strip navigation breadcrumbs
		content = content.replaceAll(PAGE_HEADER_REGEX, '')

		// Strip navigation links and separators
		content = content.replaceAll(NAV_LINK_REGEX, '')

		// Replace local .md file links with plain text (dead links in single-output)
		content = content.replaceAll(LOCAL_MD_LINK_REGEX, '`$1`')

		// Strip HTML anchor tags from table cells
		content = content.replaceAll(HTML_ANCHOR_REGEX, '')

		// Strip "Defined in" column from property tables
		content = stripDefinedInColumn(content)

		// Adjust heading levels
		content = adjustHeadingLevels(content, headingLevel)

		// Clean up excessive blank lines
		content = content.replaceAll(/\n{3,}/g, '\n\n')

		const trimmed = content.trim()
		if (trimmed.length > 0) {
			sections.push(trimmed)
		}
	}

	return sections.join('\n\n')
}

/**
 * Remove the "Defined in" column from markdown tables. It's noisy
 * in a readme context where source locations aren't useful.
 */
function stripDefinedInColumn(content: string): string {
	const lines = content.split('\n')
	let inDefinedInTable = false

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (!line.startsWith('|')) {
			inDefinedInTable = false
			continue
		}

		// Detect header row with "Defined in" as last column
		if (line.includes('| Defined in |')) {
			inDefinedInTable = true
		}

		if (inDefinedInTable) {
			// Strip last column (everything after the second-to-last pipe)
			const lastPipeIndex = line.lastIndexOf('|', line.length - 2)
			if (lastPipeIndex > 0) {
				lines[i] = line.slice(0, lastPipeIndex) + '|'
			}
		}
	}

	return lines.join('\n')
}

/**
 * Shift all markdown headings so that the minimum heading level in the
 * content matches the target level.
 */
function adjustHeadingLevels(content: string, targetLevel: number): string {
	// Find the minimum heading level in the content
	let minLevel = 7
	for (const match of content.matchAll(HEADING_REGEX)) {
		const level = match[1].length
		if (level < minLevel) {
			minLevel = level
		}
	}

	if (minLevel >= 7) return content // No headings found

	const shift = targetLevel - minLevel
	if (shift === 0) return content

	return content.replaceAll(HEADING_REGEX, (_match, hashes: string) => {
		const newLevel = Math.min(Math.max(hashes.length + shift, 1), 6)
		return `${'#'.repeat(newLevel)} `
	})
}
