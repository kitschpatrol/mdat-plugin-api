#!/usr/bin/env node

import meow from 'meow'

const cli = meow(
	`
	Usage
	  $ foo <input>

	Options
	  --rainbow, -r  Include a rainbow
`,
	{
		flags: {
			rainbow: {
				shortFlag: 'r',
				type: 'boolean',
			},
		},
		importMeta: import.meta, // This is required
	},
)
/*
{
	input: ['unicorns'],
	flags: {rainbow: true},
	...
}
*/

/**
 * Example CLI function
 * @param {string | undefined} input The input argument
 * @param {{ rainbow: boolean | undefined; } & Record<string, unknown>} flags The flags
 */
function foo(input, flags) {
	if (!input) {
		throw new Error('Input is required')
	}
	console.log(input, flags)
}

foo(cli.input.at(0), cli.flags)
