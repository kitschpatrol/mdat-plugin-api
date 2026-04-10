/* eslint-disable unicorn/no-array-reduce */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bench, describe } from 'vitest'
import { helpObjectToMarkdown } from '../src/utilities/help-object-to-markdown'
import { helpStringToObject } from '../src/utilities/help-string-to-object'

const importMetaDirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Load real-world fixtures
// ---------------------------------------------------------------------------

const helpSamplesSupported = fs
	.readdirSync(`${importMetaDirname}/assets/help-supported`)
	.filter((file) => file.endsWith('.txt'))
	.reduce<Record<string, string>>((acc, file) => {
		const name = path.basename(file, '.txt')
		const content = fs.readFileSync(`${importMetaDirname}/assets/help-supported/${file}`, 'utf8')
		return { ...acc, [name]: content }
	}, {})

// Pre-parse objects for markdown-generation benchmarks
const helpObjectsSupported = Object.fromEntries(
	Object.entries(helpSamplesSupported)
		.map(([name, text]) => {
			const object = helpStringToObject(text)
			return object ? ([name, object] as const) : undefined
		})
		.filter((entry) => entry !== undefined),
)

// ---------------------------------------------------------------------------
// Synthetic fixtures — stress-test with larger inputs
// ---------------------------------------------------------------------------

/** Generate a Yargs-style help string with `n` options and `m` commands. */
function generateYargsHelp(optionCount: number, commandCount: number): string {
	const lines: string[] = ['synth-cli <files..> [options]', '', 'A synthetic CLI for benchmarking.']

	if (commandCount > 0) {
		lines.push('', 'Commands:')
		for (let i = 0; i < commandCount; i++) {
			lines.push(`  synth-cli cmd-${i} <arg>  Run command number ${i}.`)
		}
	}

	lines.push('', 'Options:')
	for (let i = 0; i < optionCount; i++) {
		const flagName = `option-${i.toString().padStart(3, '0')}`
		lines.push(`      --${flagName}  Description for ${flagName}.  [string] [default: value-${i}]`)
	}

	lines.push(
		`  -h, --help     Show help  [boolean]`,
		`  -v, --version  Show version number  [boolean]`,
	)

	return lines.join('\n')
}

/** Generate a Commander-style help string with `n` options and `m` commands. */
function generateCommanderHelp(optionCount: number, commandCount: number): string {
	const lines: string[] = [
		'Usage: synth-cli [options] [command]',
		'',
		'A synthetic CLI for benchmarking.',
		'',
		'Options:',
	]

	for (let i = 0; i < optionCount; i++) {
		const flagName = `option-${i.toString().padStart(3, '0')}`
		const padding = ' '.repeat(Math.max(2, 30 - flagName.length - 6))
		lines.push(`  --${flagName}${padding}Description for ${flagName} (default: "value-${i}")`)
	}

	lines.push(
		`  -h, --help${' '.repeat(22)}display help for command`,
		`  -V, --version${' '.repeat(19)}output the version number`,
	)

	if (commandCount > 0) {
		lines.push('', 'Commands:')
		for (let i = 0; i < commandCount; i++) {
			const cmdName = `cmd-${i}`
			const padding = ' '.repeat(Math.max(2, 30 - cmdName.length - 6))
			lines.push(`  ${cmdName} <arg>${padding}Run command number ${i}`)
		}

		lines.push(`  help [command]${' '.repeat(19)}display help for command`)
	}

	return lines.join('\n')
}

/** Generate a Meow-style help string with `n` options. Meow doesn't support commands. */
function generateMeowHelp(optionCount: number): string {
	const lines: string[] = [
		'',
		'  A synthetic CLI for benchmarking.',
		'',
		'  Usage',
		'    $ synth-cli [options]',
		'',
		'  Options',
	]

	for (let i = 0; i < optionCount; i++) {
		const flagName = `option-${i.toString().padStart(3, '0')}`
		const padding = ' '.repeat(Math.max(2, 30 - flagName.length - 6))
		lines.push(`    --${flagName}${padding}Description for ${flagName}`)
	}

	lines.push(
		`    --help, -h${' '.repeat(20)}Show help`,
		`    --version, -v${' '.repeat(17)}Show version`,
		'',
	)

	return lines.join('\n')
}

const syntheticSmall = generateYargsHelp(10, 3)
const syntheticMedium = generateYargsHelp(50, 10)
const syntheticLarge = generateYargsHelp(200, 30)

const syntheticSmallObject = helpStringToObject(syntheticSmall)!
const syntheticMediumObject = helpStringToObject(syntheticMedium)!
const syntheticLargeObject = helpStringToObject(syntheticLarge)!

const commanderSmall = generateCommanderHelp(10, 3)
const commanderMedium = generateCommanderHelp(50, 10)
const commanderLarge = generateCommanderHelp(200, 30)

const commanderSmallObject = helpStringToObject(commanderSmall)!
const commanderMediumObject = helpStringToObject(commanderMedium)!
const commanderLargeObject = helpStringToObject(commanderLarge)!

const meowSmall = generateMeowHelp(10)
const meowMedium = generateMeowHelp(50)
const meowLarge = generateMeowHelp(200)

const meowSmallObject = helpStringToObject(meowSmall)!
const meowMediumObject = helpStringToObject(meowMedium)!
const meowLargeObject = helpStringToObject(meowLarge)!

// ---------------------------------------------------------------------------
// Benchmarks — parsing (helpStringToObject)
// ---------------------------------------------------------------------------

describe('parse: real-world fixtures', () => {
	for (const [name, helpText] of Object.entries(helpSamplesSupported)) {
		bench(`helpStringToObject — ${name}`, () => {
			helpStringToObject(helpText)
		})
	}
})

describe('parse: synthetic yargs (scaling)', () => {
	bench('helpStringToObject [yargs] — 10 opts, 3 cmds', () => {
		helpStringToObject(syntheticSmall)
	})

	bench('helpStringToObject [yargs] — 50 opts, 10 cmds', () => {
		helpStringToObject(syntheticMedium)
	})

	bench('helpStringToObject [yargs] — 200 opts, 30 cmds', () => {
		helpStringToObject(syntheticLarge)
	})
})

describe('parse: synthetic commander (scaling)', () => {
	bench('helpStringToObject [commander] — 10 opts, 3 cmds', () => {
		helpStringToObject(commanderSmall)
	})

	bench('helpStringToObject [commander] — 50 opts, 10 cmds', () => {
		helpStringToObject(commanderMedium)
	})

	bench('helpStringToObject [commander] — 200 opts, 30 cmds', () => {
		helpStringToObject(commanderLarge)
	})
})

describe('parse: synthetic meow (scaling)', () => {
	bench('helpStringToObject [meow] — 10 opts', () => {
		helpStringToObject(meowSmall)
	})

	bench('helpStringToObject [meow] — 50 opts', () => {
		helpStringToObject(meowMedium)
	})

	bench('helpStringToObject [meow] — 200 opts', () => {
		helpStringToObject(meowLarge)
	})
})

// ---------------------------------------------------------------------------
// Benchmarks — markdown generation (helpObjectToMarkdown)
// ---------------------------------------------------------------------------

describe('markdown: real-world fixtures', () => {
	for (const [name, object] of Object.entries(helpObjectsSupported)) {
		bench(`helpObjectToMarkdown — ${name}`, () => {
			helpObjectToMarkdown(object)
		})
	}
})

describe('markdown: synthetic yargs (scaling)', () => {
	bench('helpObjectToMarkdown [yargs] — 10 opts, 3 cmds', () => {
		helpObjectToMarkdown(syntheticSmallObject)
	})

	bench('helpObjectToMarkdown [yargs] — 50 opts, 10 cmds', () => {
		helpObjectToMarkdown(syntheticMediumObject)
	})

	bench('helpObjectToMarkdown [yargs] — 200 opts, 30 cmds', () => {
		helpObjectToMarkdown(syntheticLargeObject)
	})
})

describe('markdown: synthetic commander (scaling)', () => {
	bench('helpObjectToMarkdown [commander] — 10 opts, 3 cmds', () => {
		helpObjectToMarkdown(commanderSmallObject)
	})

	bench('helpObjectToMarkdown [commander] — 50 opts, 10 cmds', () => {
		helpObjectToMarkdown(commanderMediumObject)
	})

	bench('helpObjectToMarkdown [commander] — 200 opts, 30 cmds', () => {
		helpObjectToMarkdown(commanderLargeObject)
	})
})

describe('markdown: synthetic meow (scaling)', () => {
	bench('helpObjectToMarkdown [meow] — 10 opts', () => {
		helpObjectToMarkdown(meowSmallObject)
	})

	bench('helpObjectToMarkdown [meow] — 50 opts', () => {
		helpObjectToMarkdown(meowMediumObject)
	})

	bench('helpObjectToMarkdown [meow] — 200 opts', () => {
		helpObjectToMarkdown(meowLargeObject)
	})
})

// ---------------------------------------------------------------------------
// Benchmarks — full pipeline (parse + markdown)
// ---------------------------------------------------------------------------

describe('full pipeline: real-world fixtures', () => {
	for (const [name, helpText] of Object.entries(helpSamplesSupported)) {
		bench(`parse + markdown — ${name}`, () => {
			const object = helpStringToObject(helpText)
			if (object) {
				helpObjectToMarkdown(object)
			}
		})
	}
})

describe('full pipeline: synthetic yargs (scaling)', () => {
	bench('parse + markdown [yargs] — 10 opts, 3 cmds', () => {
		const object = helpStringToObject(syntheticSmall)
		if (object) helpObjectToMarkdown(object)
	})

	bench('parse + markdown [yargs] — 50 opts, 10 cmds', () => {
		const object = helpStringToObject(syntheticMedium)
		if (object) helpObjectToMarkdown(object)
	})

	bench('parse + markdown [yargs] — 200 opts, 30 cmds', () => {
		const object = helpStringToObject(syntheticLarge)
		if (object) helpObjectToMarkdown(object)
	})
})

describe('full pipeline: synthetic commander (scaling)', () => {
	bench('parse + markdown [commander] — 10 opts, 3 cmds', () => {
		const object = helpStringToObject(commanderSmall)
		if (object) helpObjectToMarkdown(object)
	})

	bench('parse + markdown [commander] — 50 opts, 10 cmds', () => {
		const object = helpStringToObject(commanderMedium)
		if (object) helpObjectToMarkdown(object)
	})

	bench('parse + markdown [commander] — 200 opts, 30 cmds', () => {
		const object = helpStringToObject(commanderLarge)
		if (object) helpObjectToMarkdown(object)
	})
})

describe('full pipeline: synthetic meow (scaling)', () => {
	bench('parse + markdown [meow] — 10 opts', () => {
		const object = helpStringToObject(meowSmall)
		if (object) helpObjectToMarkdown(object)
	})

	bench('parse + markdown [meow] — 50 opts', () => {
		const object = helpStringToObject(meowMedium)
		if (object) helpObjectToMarkdown(object)
	})

	bench('parse + markdown [meow] — 200 opts', () => {
		const object = helpStringToObject(meowLarge)
		if (object) helpObjectToMarkdown(object)
	})
})
