import { execa } from 'execa'
import type { ProgramInfo } from './parsers/index'
import { helpObjectToMarkdown } from './help-object-to-markdown'
import { helpStringToObject } from './help-string-to-object'
import { log } from './log'

/**
 * Get help output from a CLI command and return it as markdown
 *
 * @param cliCommand - The executable path (may contain spaces, e.g. on Windows)
 * @param helpFlag - The flag to pass to get help output
 * @param depth - Max recursion depth for subcommands
 */
export async function getHelpMarkdown(
	cliCommand: string,
	helpFlag = '--help',
	depth?: number,
): Promise<string> {
	return getHelpMarkdownInternal(cliCommand, [], helpFlag, depth ?? Number.MAX_SAFE_INTEGER)
}

async function getHelpMarkdownInternal(
	executable: string,
	subcommands: string[],
	helpFlag: string,
	depth: number,
): Promise<string> {
	// Throws
	const rawHelpString = await getHelpString(executable, [...subcommands, helpFlag])

	// Attempt to parse typical Yargs help output
	const programInfo = helpStringToObject(rawHelpString)

	// Fall back to basic code fence output if parsing fails
	if (programInfo === undefined) {
		log.debug(`Falling back to basic cli help text output.`)
		return renderHelpMarkdownBasic(rawHelpString)
	}

	// This might recurse for subcommands
	return renderHelpMarkdownObject(executable, subcommands, helpFlag, depth, programInfo)
}

async function renderHelpMarkdownObject(
	executable: string,
	subcommands: string[],
	helpFlag: string,
	depth: number,
	programInfo: ProgramInfo,
): Promise<string> {
	if (depth <= 0) {
		log.warn(`Max CLI command help depth reached, stopping recursion`)
		return ''
	}

	let markdown = helpObjectToMarkdown(programInfo, depth)

	// Check for subcommands
	if (programInfo.commands) {
		for (const command of programInfo.commands) {
			if (!command.parentCommandName || !command.commandName) continue
			const subCommandHelp = await getHelpMarkdownInternal(
				executable,
				[...subcommands, command.commandName],
				helpFlag,
				depth - 1,
			)
			// Recursion limit returns empty string
			if (subCommandHelp === '') return markdown

			markdown += `\n\n${subCommandHelp}`
		}
	}

	return markdown
}

/**
 * Exported for testing
 */
export function renderHelpMarkdownBasic(rawHelpString: string): string {
	return `\`\`\`txt\n${rawHelpString}\n\`\`\``
}

/**
 * Run the CLI help command and return the output, throw if there's no output
 *
 * @returns The full help string from the resolved command
 * @throws {TypeError} If there's an error running the CLI help command
 */
async function getHelpString(command: string, args: string[]): Promise<string> {
	const displayCommand = `${command} ${args.join(' ')}`
	let rawHelpString: string | undefined
	try {
		const { stderr, stdout } = await execa(command, args, { preferLocal: true })
		rawHelpString = stdout

		// eslint-disable-next-line ts/no-unnecessary-condition
		if (rawHelpString === undefined || rawHelpString === '') {
			rawHelpString = stderr
		}
	} catch (error) {
		if (error instanceof Error) {
			throw new TypeError(`Error running CLI help command: "${displayCommand}"\n${error.message}\n`)
		}
	}

	if (rawHelpString === undefined || rawHelpString === '') {
		throw new Error(`No result from running CLI help command: "${displayCommand}"\n`)
	}

	return rawHelpString
}
