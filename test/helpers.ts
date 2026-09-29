import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ApiMarkdownOptions } from '../src/utilities/get-api-markdown'
import { getApiMarkdown } from '../src/utilities/get-api-markdown'

/**
 * Absolute path to a file in the fixtures directory.
 */
export function fixture(relativePath: string): string {
	return path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/fixtures', relativePath)
}

/**
 * Generate API Markdown with the plugin's default options.
 */
export async function generate(
	entryPoint: string,
	overrides: Partial<ApiMarkdownOptions> = {},
): Promise<string> {
	return getApiMarkdown({
		entryPoint,
		exclude: [],
		format: 'full',
		groupByKind: true,
		headingLevel: 3,
		include: [],
		sort: ['source-order'],
		...overrides,
	})
}

const HEADING_REGEX = /^#+ /v

/**
 * Lines that are Markdown headings, in order.
 */
export function headings(markdown: string): string[] {
	return markdown.split('\n').filter((line) => HEADING_REGEX.test(line))
}

/**
 * A regular expression matching text that contains each needle in order.
 */
export function inOrder(needles: string[]): RegExp {
	return new RegExp(needles.map((needle) => RegExp.escape(needle)).join('[^]*'), 'v')
}
