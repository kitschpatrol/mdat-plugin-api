const FENCE_REGEX = /^\s{0,3}(`{3,}|~{3,})/v
const HEADING_REGEX = /^(#+) (.*)$/v
const BACKTICK_RUN_REGEX = /`+/gv
const LEADING_WHITESPACE_REGEX = /^\s*/v
const MAX_HEADING_LEVEL = 6

/**
 * A line of Markdown, flagged when it's part of a fenced code block (including
 * the fence lines themselves).
 */
export type ClassifiedLine = {
	isCode: boolean
	line: string
}

/**
 * Split Markdown into lines, flagging the ones inside fenced code blocks.
 */
export function classifyLines(markdown: string): ClassifiedLine[] {
	const lines: ClassifiedLine[] = []
	let openFence: string | undefined

	for (const line of markdown.split('\n')) {
		const fence = FENCE_REGEX.exec(line)?.[1]

		if (openFence === undefined) {
			openFence = fence
			lines.push({ isCode: fence !== undefined, line })
		} else {
			if (fence !== undefined && fence.startsWith(openFence) && line.trim() === fence) {
				openFence = undefined
			}

			lines.push({ isCode: true, line })
		}
	}

	return lines
}

/**
 * Apply a transform to every line outside of fenced code blocks. The transform
 * may return several lines joined with newlines, or `undefined` to drop the
 * line.
 */
export function mapLinesOutsideFences(
	markdown: string,
	transform: (line: string) => string | undefined,
): string {
	const output: string[] = []

	for (const { isCode, line } of classifyLines(markdown)) {
		const transformed = isCode ? line : transform(line)
		if (transformed !== undefined) {
			output.push(transformed)
		}
	}

	return output.join('\n')
}

/**
 * Apply a transform to every heading outside of fenced code blocks. Returning
 * `undefined` leaves the heading unchanged.
 */
function mapHeadings(
	markdown: string,
	transform: (level: number, text: string) => string | undefined,
): string {
	return mapLinesOutsideFences(markdown, (line) => {
		const match = HEADING_REGEX.exec(line)
		return match?.[1] === undefined || match[2] === undefined
			? line
			: (transform(match[1].length, match[2]) ?? line)
	})
}

/**
 * Shift every heading so that the shallowest one lands on `targetLevel`.
 * Headings may end up deeper than Markdown's maximum of six, which is resolved
 * by `demoteOverflowHeadings` once all shifting is done.
 */
export function shiftHeadings(markdown: string, targetLevel: number): string {
	let minLevel = Infinity
	mapHeadings(markdown, (level) => {
		minLevel = Math.min(minLevel, level)
	})

	const shift = targetLevel - minLevel
	return shift === 0 || !Number.isFinite(shift)
		? markdown
		: mapHeadings(markdown, (level, text) => `${'#'.repeat(level + shift)} ${text}`)
}

/**
 * Markdown has no headings deeper than level six, so render any that ended up
 * deeper as bold text.
 */
export function demoteOverflowHeadings(markdown: string): string {
	return mapHeadings(markdown, (level, text) =>
		level > MAX_HEADING_LEVEL ? `**${text}**` : undefined,
	)
}

/**
 * Collapse runs of blank lines outside of fenced code blocks down to one.
 */
export function collapseBlankLines(markdown: string): string {
	const output: string[] = []
	let isPreviousBlank = false

	for (const { isCode, line } of classifyLines(markdown)) {
		const isBlank = !isCode && line.trim() === ''
		if (!isBlank || !isPreviousBlank) {
			output.push(line)
		}

		isPreviousBlank = isBlank
	}

	return output.join('\n')
}

/**
 * Build a GitHub-style anchor slug from heading text.
 */
export function slugify(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}\s_\-]/gv, '')
		.replaceAll(/\s/gv, '-')
}

/**
 * Escape text for use inside a GitHub-flavored Markdown table cell.
 */
export function escapeTableCell(text: string): string {
	return text
		.replaceAll(/\s*\n\s*/gv, ' ')
		.replaceAll('|', String.raw`\|`)
		.trim()
}

/**
 * Wrap text in a code span, using a delimiter longer than any run of backticks
 * inside it.
 */
export function codeSpan(text: string): string {
	const longestRun = Math.max(
		0,
		...Array.from(text.matchAll(BACKTICK_RUN_REGEX), (match) => match[0].length),
	)
	const delimiter = '`'.repeat(longestRun + 1)
	const isPadded = text.startsWith('`') || text.endsWith('`')
	return isPadded ? `${delimiter} ${text} ${delimiter}` : `${delimiter}${text}${delimiter}`
}

/**
 * TypeDoc trims the first line of an `@example` block but leaves the rest
 * alone, so examples written in the indented JSDoc style (a tab after `*`) keep
 * a stray indent on every line but the first. Strip the indent shared by the
 * remaining lines. Code that genuinely indents every line after the first (e.g.
 * an unbraced `if`) loses that indent too, which is a tolerable loss.
 */
export function dedentCodeBlock(block: string): string {
	const lines = block.split('\n')
	const [openingFence, firstLine] = lines
	const closingFence = lines.at(-1)
	const rest = lines.slice(2, -1)

	if (
		openingFence === undefined ||
		firstLine === undefined ||
		closingFence === undefined ||
		rest.length === 0 ||
		(LEADING_WHITESPACE_REGEX.exec(firstLine)?.[0] ?? '') !== ''
	) {
		return block
	}

	const indents = rest
		.filter((line) => line.trim() !== '')
		.map((line) => LEADING_WHITESPACE_REGEX.exec(line)?.[0] ?? '')
	const commonIndent = getCommonPrefix(indents)

	if (commonIndent === '') {
		return block
	}

	return [
		openingFence,
		firstLine,
		...rest.map((line) => (line.startsWith(commonIndent) ? line.slice(commonIndent.length) : line)),
		closingFence,
	].join('\n')
}

function getCommonPrefix(strings: string[]): string {
	let prefix = strings[0] ?? ''

	for (const string of strings) {
		while (!string.startsWith(prefix)) {
			prefix = prefix.slice(0, -1)
		}
	}

	return prefix
}
