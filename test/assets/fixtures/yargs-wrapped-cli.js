#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
	.scriptName('wrapped-cli')
	.usage('$0 <files..> [options]\n\nA complex CLI that demonstrates wrapping behavior.')
	.wrap(60)
	.command('deploy', 'Deploy the application')
	.command('migrate', 'Run database migrations')
	.command('generate', 'Generate boilerplate code')
	.option('config', {
		alias: 'c',
		default: './config/default.yml',
		describe:
			'Path to the configuration file that controls deployment settings and environment variables',
		type: 'string',
	})
	.option('output', {
		alias: 'o',
		default: './dist',
		describe: 'Output directory for generated files and build artifacts',
		type: 'string',
	})
	.option('log-level', {
		choices: ['debug', 'info', 'warn', 'error'],
		default: 'info',
		describe: 'Set the logging verbosity level for console and file output',
		type: 'string',
	})
	.option('max-retries', {
		default: 3,
		describe: 'Maximum number of retry attempts for failed network requests before giving up',
		type: 'number',
	})
	.option('dry-run', {
		describe:
			'Preview changes without actually executing them, useful for verifying deployment plans',
		type: 'boolean',
	})
	.option('parallel', {
		alias: 'p',
		default: 4,
		describe: 'Number of parallel workers to use for concurrent task execution',
		type: 'number',
	})
	.option('timeout', {
		alias: 't',
		default: 30_000,
		describe: 'Request timeout in milliseconds for all outgoing HTTP connections',
		type: 'number',
	})
	.option('format', {
		alias: 'f',
		choices: ['json', 'yaml', 'toml', 'xml'],
		default: 'json',
		describe: 'Output format for generated configuration files and exported data',
		type: 'string',
	})
	.option('include-deprecated', {
		default: false,
		describe: 'Include deprecated API endpoints and legacy compatibility shims in the output',
		type: 'boolean',
	})
	.option('cache-dir', {
		default: '.cache',
		describe: 'Directory for storing temporary build cache and intermediate compilation artifacts',
		type: 'string',
	})
	.help()
	.version()
	.parseSync()
