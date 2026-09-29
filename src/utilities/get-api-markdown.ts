import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ProjectOptions } from './typedoc-project'
import { log } from './log'
import { demoteOverflowHeadings } from './markdown'
import { renderCompact } from './render-compact'
import { renderFull } from './render-full'
import { convertProject } from './typedoc-project'

/**
 * Fully resolved options for generating API Markdown.
 */
export type ApiMarkdownOptions = Omit<ProjectOptions, 'outputDirectory'> & {
	/** Heading level for the shallowest headings in the output (1–6). */
	headingLevel: number
}

/**
 * Generate Markdown API documentation for a TypeScript entry point.
 *
 * @returns Markdown with headings starting at `headingLevel`, or throws if the
 *   entry point has no documentable exports.
 */
export async function getApiMarkdown(options: ApiMarkdownOptions): Promise<string> {
	const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdat-plugin-api-'))
	log.debug(`Generating ${options.format} API docs for ${options.entryPoint} in ${outputDirectory}`)

	try {
		const { app, project } = await convertProject({ ...options, outputDirectory })
		const markdown =
			options.format === 'compact'
				? renderCompact(project, options)
				: await renderFull(app, project, { ...options, outputDirectory })
		const finalized = demoteOverflowHeadings(markdown).trim()

		if (finalized === '') {
			throw new Error(`No public API exports found in: ${options.entryPoint}`)
		}

		return finalized
	} finally {
		await fs.rm(outputDirectory, { force: true, recursive: true })
	}
}
