#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
	.scriptName('test-cli')
	.usage('$0 [options] [command]\n\nA test CLI for normalization verification.')
	.wrap(200)
	.command('greet <name>', 'Greet someone by name')
	.command('serve [port]', 'Start a server')
	.option('name', { alias: 'n', default: 'world', describe: 'Name to greet', type: 'string' })
	.option('verbose', { describe: 'Enable verbose output', type: 'boolean' })
	.help()
	.parseSync()
