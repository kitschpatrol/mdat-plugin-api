import { defineConfig } from 'mdat'
import { z } from 'zod'
import { getHelpMarkdown } from './utilities/get-help-markdown'
import { inferCommand } from './utilities/infer-command'
export { setLogger } from './utilities/log'

const cliHelpRule = defineConfig({
	cli: {
		async content(options?, _context?) {
			const validOptions = z
				.object({
					cliCommand: z.string().optional(),
					depth: z.number().optional(),
					helpFlag: z.string().optional(),
				})
				.optional()
				.parse(options)
			const resolvedCommand = await inferCommand(validOptions?.cliCommand)
			return getHelpMarkdown(resolvedCommand, validOptions?.helpFlag, validOptions?.depth)
		},
	},
})

export default defineConfig({ cli: cliHelpRule.cli, 'cli-help': cliHelpRule.cli })
