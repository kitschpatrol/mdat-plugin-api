import { defineConfig } from 'mdat'
import { z } from 'zod'
import { getApiMarkdown } from './utilities/get-api-markdown'
import { resolveEntryPoint } from './utilities/resolve-entry-point'
export { setLogger } from './utilities/log'

/**
 * Options for the `<!-- api -->` rule.
 *
 * Pass these as a JSON5 argument in the comment tag, e.g. `<!--
 * api({entryPoint: "src/index.ts", headingLevel: 2}) -->`.
 */
export type ApiRuleOptions = {
	/**
	 * Path to the TypeScript entry point file. If omitted, the entry point is
	 * inferred from `package.json` fields (`exports`, `types`, `main`) or common
	 * defaults (`src/index.ts`).
	 */
	entryPoint?: string
	/**
	 * Starting heading level for the generated documentation (1-6).
	 *
	 * @defaultValue 3
	 */
	headingLevel?: number
	/** Path to a custom `tsconfig.json` file. Auto-detected if omitted. */
	tsconfig?: string
}

const optionsSchema = z
	.object({
		entryPoint: z.string().optional(),
		headingLevel: z.number().min(1).max(6).optional().default(3),
		tsconfig: z.string().optional(),
	})
	.optional()

/**
 * Mdat plugin that generates API documentation from TypeScript source files.
 *
 * Uses TypeDoc and typedoc-plugin-markdown under the hood to extract JSDoc
 * descriptions, type signatures, `@example` code blocks, and parameter tables
 * from public exports.
 *
 * Register in your `mdat.config.ts`, then embed `<!-- api -->` placeholder
 * comments in your Markdown files:
 *
 * @example
 * 	import { defineConfig } from 'mdat'
 * 	import apiPlugin from 'mdat-plugin-api'
 *
 * 	export default defineConfig({
 * 		...apiPlugin,
 * 	})
 */
const apiPlugin = defineConfig({
	api: {
		async content(options?) {
			const validOptions = optionsSchema.parse(options)
			const entryPoint = await resolveEntryPoint(validOptions?.entryPoint)

			return getApiMarkdown(entryPoint, validOptions?.headingLevel ?? 3, validOptions?.tsconfig)
		},
	},
})

export default apiPlugin
