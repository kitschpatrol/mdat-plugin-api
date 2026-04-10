#!/usr/bin/env node

import meow from 'meow'

meow(
	`
  A test CLI for normalization verification.

  Usage
    $ test-cli [options]

  Options
    --name, -n <value>  Name to greet
    --verbose           Enable verbose output
    --help, -h          Show help
    --version, -v       Show version
`,
	{
		description: false,
		flags: {
			name: {
				shortFlag: 'n',
				type: 'string',
			},
			verbose: {
				type: 'boolean',
			},
		},
		importMeta: import.meta,
	},
)
