import type { SortStrategy } from 'typedoc'
import { defineConfig } from 'mdat'
import path from 'node:path'
import { z } from 'zod'
import { getApiMarkdown } from './utilities/get-api-markdown'
import { resolveEntryPoint } from './utilities/resolve-entry-point'
export { setLogger } from './utilities/log'

/**
 * Options for the `<!-- api -->` rule.
 *
 * Pass them as a JSON5 object in the placeholder comment, e.g. `<!-- api({
 * format: 'compact', include: ['greet', '*Options'] }) -->`.
 */
export type ApiRuleOptions = {
	/**
	 * Path to the TypeScript entry point, relative to the working directory. When
	 * omitted, it's inferred from `package.json` (`exports`, `types`, `main`,
	 * `module`), mapping build output like `./dist/index.js` back to
	 * `./src/index.ts`, and finally from common defaults like `src/index.ts`.
	 */
	entryPoint?: string
	/**
	 * Names of top-level exports to leave out. Supports `*` wildcards, e.g.
	 * `['setLogger', 'default*']`. Applied after `include`.
	 */
	exclude?: string[]
	/**
	 * Output style. `full` documents every export completely: signatures,
	 * parameter and property tables, and examples. `compact` renders one table
	 * row per export, with a subsection per namespace.
	 *
	 * @defaultValue 'full'
	 */
	format?: 'compact' | 'full'
	/**
	 * Group exports under Functions, Classes, Type Aliases, etc. headings. When
	 * `false`, exports are listed together in `sort` order.
	 *
	 * @defaultValue true
	 */
	groupByKind?: boolean
	/**
	 * Heading level for the shallowest headings in the generated Markdown (1–6).
	 * Nested headings that would exceed level 6 are rendered as bold text.
	 *
	 * @defaultValue 3
	 */
	headingLevel?: number
	/**
	 * Names of top-level exports to document. Supports `*` wildcards, e.g.
	 * `['greet', '*Options']`. A namespace is included with all of its members.
	 * Everything is documented when omitted.
	 */
	include?: string[]
	/**
	 * TypeDoc sort strategies applied to members, in priority order.
	 *
	 * @defaultValue ['source-order']
	 */
	sort?: SortStrategy[]
	/**
	 * Path to a `tsconfig.json`, relative to the working directory. TypeDoc finds
	 * the nearest one when omitted.
	 */
	tsconfig?: string
}

const SORT_STRATEGIES = [
	'source-order',
	'alphabetical',
	'alphabetical-ignoring-documents',
	'enum-value-ascending',
	'enum-value-descending',
	'enum-member-source-order',
	'static-first',
	'instance-first',
	'visibility',
	'required-first',
	'kind',
	'external-last',
	'documents-first',
	'documents-last',
] as const satisfies readonly SortStrategy[]

const optionsSchema = z.strictObject({
	entryPoint: z.string().optional(),
	exclude: z.array(z.string()).default([]),
	format: z.enum(['compact', 'full']).default('full'),
	groupByKind: z.boolean().default(true),
	headingLevel: z.number().int().min(1).max(6).default(3),
	include: z.array(z.string()).default([]),
	sort: z.array(z.enum(SORT_STRATEGIES)).default(['source-order']),
	tsconfig: z.string().optional(),
})

/**
 * Mdat plugin that generates API documentation from TypeScript source files.
 *
 * Uses TypeDoc to extract JSDoc descriptions, type signatures, `@example`
 * blocks, and parameter tables from a package's public exports.
 *
 * Register it in your `mdat.config.ts`, then add `<!-- api -->` placeholder
 * comments to your Markdown files.
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
		async content(options) {
			const parsed = optionsSchema.safeParse(options ?? {})
			if (!parsed.success) {
				throw new Error(
					`Invalid options for the <!-- api --> rule:\n${z.prettifyError(parsed.error)}`,
				)
			}

			const { entryPoint, tsconfig, ...rest } = parsed.data

			return getApiMarkdown({
				...rest,
				entryPoint: await resolveEntryPoint(entryPoint),
				...(tsconfig !== undefined && { tsconfig: path.resolve(tsconfig) }),
			})
		},
	},
})

export default apiPlugin
