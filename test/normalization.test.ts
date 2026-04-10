import { execa } from 'execa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ProgramInfo } from '../src/utilities/parsers/index'
import { getHelpMarkdown } from '../src/utilities/get-help-markdown'
import { helpStringToObject } from '../src/utilities/help-string-to-object'

const importMetaDirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDirectory = `${importMetaDirname}/assets/fixtures`

/**
 * Wide columns to prevent line wrapping in CLI help output.
 * Both Yargs and Commander respect the COLUMNS environment variable.
 * Meow doesn't wrap (it outputs the help text as-is).
 */
// eslint-disable-next-line ts/naming-convention
const wideEnv = { ...process.env, COLUMNS: '200' }

/**
 * Execute a fixture CLI script and parse its --help output.
 */
async function getFixtureHelp(script: string): Promise<{ parsed: ProgramInfo; raw: string }> {
	const { stderr, stdout } = await execa('node', [`${fixturesDirectory}/${script}`, '--help'], {
		env: wideEnv,
	})

	const raw = stdout || stderr
	const parsed = helpStringToObject(raw)

	if (parsed === undefined) {
		throw new Error(`Failed to parse help output from ${script}:\n${raw}`)
	}

	return { parsed, raw }
}

describe('cross-framework normalization', { timeout: 30_000 }, () => {
	let meowParsed: ProgramInfo
	let yargsParsed: ProgramInfo
	let commanderParsed: ProgramInfo

	beforeAll(async () => {
		const [meow, yargs, commander] = await Promise.all([
			getFixtureHelp('meow-cli.js'),
			getFixtureHelp('yargs-cli.js'),
			getFixtureHelp('commander-cli.js'),
		])

		meowParsed = meow.parsed
		yargsParsed = yargs.parsed
		commanderParsed = commander.parsed
	})

	it('should parse meow fixture help output', () => {
		expect(meowParsed).toBeDefined()
		expect(meowParsed.commandName).toBe('test-cli')
		expect(meowParsed).toMatchSnapshot()
	})

	it('should parse yargs fixture help output', () => {
		expect(yargsParsed).toBeDefined()
		expect(yargsParsed.commandName).toBe('test-cli')
		expect(yargsParsed).toMatchSnapshot()
	})

	it('should parse commander fixture help output', () => {
		expect(commanderParsed).toBeDefined()
		expect(commanderParsed.commandName).toBe('test-cli')
		expect(commanderParsed).toMatchSnapshot()
	})

	it('should produce equivalent descriptions across all frameworks', () => {
		// All three should have the same description
		expect(yargsParsed.description).toBe('A test CLI for normalization verification.')
		expect(commanderParsed.description).toBe('A test CLI for normalization verification.')
		expect(meowParsed.description).toBe('A test CLI for normalization verification.')
	})

	it('should produce equivalent --name option across all frameworks', () => {
		// Find the --name option in each parsed result
		const meowName = meowParsed.options?.find((o) => o.flags?.includes('--name'))
		const yargsName = yargsParsed.options?.find((o) => o.flags?.includes('--name'))
		const commanderName = commanderParsed.options?.find((o) => o.flags?.includes('--name'))

		// All should have --name flag
		expect(meowName).toBeDefined()
		expect(yargsName).toBeDefined()
		expect(commanderName).toBeDefined()

		// All should have -n alias
		expect(meowName!.aliases).toContain('-n')
		expect(yargsName!.aliases).toContain('-n')
		expect(commanderName!.aliases).toContain('-n')

		// All should have "Name to greet" in description
		expect(meowName!.description).toContain('Name to greet')
		expect(yargsName!.description).toContain('Name to greet')
		expect(commanderName!.description).toContain('Name to greet')

		// Yargs and Commander should have a default value containing "world"
		// (Yargs preserves quotes: "world", Commander strips them: world)
		expect(yargsName!.defaultValue).toContain('world')
		expect(commanderName!.defaultValue).toContain('world')
	})

	it('should produce equivalent --verbose option across all frameworks', () => {
		// Find the --verbose option in each parsed result
		const meowVerbose = meowParsed.options?.find((o) => o.flags?.includes('--verbose'))
		const yargsVerbose = yargsParsed.options?.find((o) => o.flags?.includes('--verbose'))
		const commanderVerbose = commanderParsed.options?.find((o) => o.flags?.includes('--verbose'))

		// All should have --verbose flag
		expect(meowVerbose).toBeDefined()
		expect(yargsVerbose).toBeDefined()
		expect(commanderVerbose).toBeDefined()

		// All should have similar descriptions
		expect(meowVerbose!.description).toContain('Enable verbose output')
		expect(yargsVerbose!.description).toContain('Enable verbose output')
		expect(commanderVerbose!.description).toContain('Enable verbose output')
	})

	it('should produce equivalent commands between yargs and commander', () => {
		// Both should have commands
		expect(yargsParsed.commands).toBeDefined()
		expect(commanderParsed.commands).toBeDefined()

		// Find the greet command
		const yargsGreet = yargsParsed.commands?.find((c) => c.commandName === 'greet')
		const commanderGreet = commanderParsed.commands?.find((c) => c.commandName === 'greet')

		expect(yargsGreet).toBeDefined()
		expect(commanderGreet).toBeDefined()
		expect(yargsGreet!.description).toBe('Greet someone by name')
		expect(commanderGreet!.description).toBe('Greet someone by name')

		// Both should have <name> argument
		expect(yargsGreet!.arguments).toContain('<name>')
		expect(commanderGreet!.arguments).toContain('<name>')

		// Find the serve command
		const yargsServe = yargsParsed.commands?.find((c) => c.commandName === 'serve')
		const commanderServe = commanderParsed.commands?.find((c) => c.commandName === 'serve')

		expect(yargsServe).toBeDefined()
		expect(commanderServe).toBeDefined()
		expect(yargsServe!.description).toBe('Start a server')
		expect(commanderServe!.description).toBe('Start a server')
	})

	it('should set parentCommandName on commander commands for recursion', () => {
		// Commander commands need parentCommandName for the recursive subcommand flow
		for (const cmd of commanderParsed.commands ?? []) {
			if (cmd.commandName) {
				expect(cmd.parentCommandName).toBe('test-cli')
			}
		}
	})
})

describe('yargs wrapped output', { timeout: 30_000 }, () => {
	it('should parse heavily wrapped yargs help output', async () => {
		// Use the wrapped CLI fixture which sets .wrap(60) to force narrow wrapping
		// eslint-disable-next-line ts/naming-convention
		const narrowEnv = { ...process.env, COLUMNS: '60' }
		const { stderr, stdout } = await execa(
			'node',
			[`${fixturesDirectory}/yargs-wrapped-cli.js`, '--help'],
			{ env: narrowEnv },
		)

		const raw = stdout || stderr

		// Verify the output is actually wrapped (contains continuation lines)
		expect(raw).toContain('\n                            ')

		const parsed = helpStringToObject(raw)
		expect(parsed).toBeDefined()
		expect(parsed!.commandName).toBe('wrapped-cli')
		expect(parsed!.description).toContain('A complex CLI that demonstrates wrapping behavior')

		// Verify commands are parsed (they fit on one line at .wrap(60))
		expect(parsed!.commands).toBeDefined()
		const deploy = parsed!.commands?.find((c) => c.commandName === 'deploy')
		const migrate = parsed!.commands?.find((c) => c.commandName === 'migrate')
		const generate = parsed!.commands?.find((c) => c.commandName === 'generate')
		expect(deploy).toBeDefined()
		expect(deploy!.description).toContain('Deploy the application')
		expect(migrate).toBeDefined()
		expect(migrate!.description).toContain('Run database migrations')
		expect(generate).toBeDefined()
		expect(generate!.description).toContain('Generate boilerplate code')

		// Verify options with wrapped descriptions + metadata are parsed correctly
		expect(parsed!.options).toBeDefined()

		// --config: description wraps across 4 lines, then [string] [default:] on another
		const config = parsed!.options?.find((o) => o.flags?.includes('--config'))
		expect(config).toBeDefined()
		expect(config!.description).toContain('Path to the configuration file')
		expect(config!.aliases).toContain('-c')

		// --log-level: description wraps, then [choices:] and [default:] on separate lines
		const logLevel = parsed!.options?.find((o) => o.flags?.includes('--log-level'))
		expect(logLevel).toBeDefined()
		expect(logLevel!.description).toContain('Set the logging verbosity level')

		// --dry-run: description wraps, then just [boolean] on its own line
		const dryRun = parsed!.options?.find((o) => o.flags?.includes('--dry-run'))
		expect(dryRun).toBeDefined()
		expect(dryRun!.description).toContain('Preview changes without actually executing')

		// --format: description wraps, [choices:] and [default:] on separate lines
		const format = parsed!.options?.find((o) => o.flags?.includes('--format'))
		expect(format).toBeDefined()

		expect(parsed).toMatchSnapshot()
	})
})

describe('commander recursive subcommand help', { timeout: 30_000 }, () => {
	it('should recursively resolve commander subcommand help output', async () => {
		const helpMarkdown = await getHelpMarkdown(`${fixturesDirectory}/commander-cli.js`, '--help', 2)

		// Should contain the top-level command section
		expect(helpMarkdown).toContain('Command: `test-cli`')

		// Should contain subcommand sections from recursive help calls
		expect(helpMarkdown).toContain('Subcommand: `test-cli greet`')
		expect(helpMarkdown).toContain('Subcommand: `test-cli serve`')

		// Should contain subcommand descriptions
		expect(helpMarkdown).toContain('Greet someone by name')
		expect(helpMarkdown).toContain('Start a server')

		expect(helpMarkdown).toMatchSnapshot()
	})
})
