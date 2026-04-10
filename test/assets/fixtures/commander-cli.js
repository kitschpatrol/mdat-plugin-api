#!/usr/bin/env node

import { Command } from 'commander'

const program = new Command()

program
	.name('test-cli')
	.description('A test CLI for normalization verification.')
	.version('1.0.0')
	.option('-n, --name <value>', 'Name to greet', 'world')
	.option('--verbose', 'Enable verbose output')

program.command('greet <name>').description('Greet someone by name')
program.command('serve [port]').description('Start a server')

program.parse()
