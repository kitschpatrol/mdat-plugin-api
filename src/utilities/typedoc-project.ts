import type {
	Comment,
	ContainerReflection,
	Context,
	DeclarationReflection,
	ProjectReflection,
	SortStrategy,
	TypeDocOptions,
} from 'typedoc'
import type { PluginOptions } from 'typedoc-plugin-markdown'
import fs from 'node:fs/promises'
import { Application, Converter, normalizePath, ReflectionGroup, ReflectionKind } from 'typedoc'
import ts from 'typescript'
import { log } from './log'
import { dedentCodeBlock } from './markdown'
import { LibraryLogger } from './typedoc-logger'

/**
 * Options controlling how TypeDoc converts the entry point into a project
 * reflection.
 */
export type ProjectOptions = {
	/** Absolute path to the TypeScript entry point. */
	entryPoint: string
	/** Top-level export name patterns to drop. Supports `*` wildcards. */
	exclude: string[]
	/**
	 * Output style. Full mode loads typedoc-plugin-markdown and renders pages
	 * into `outputDirectory`.
	 */
	format: 'compact' | 'full'
	/** Whether members are grouped by kind. */
	groupByKind: boolean
	/** Top-level export name patterns to keep. Supports `*` wildcards. */
	include: string[]
	/** Directory that full mode renders Markdown pages into. */
	outputDirectory: string
	/** TypeDoc sort strategies, in priority order. */
	sort: SortStrategy[]
	/**
	 * Absolute path to a tsconfig file. TypeDoc finds the nearest one when
	 * omitted.
	 */
	tsconfig?: string
}

/**
 * Order of member groups in the output. Top-level members come first and
 * namespaces last. The `*` entry catches anything else (references,
 * documents).
 */
const GROUP_ORDER = [
	'Functions',
	'Classes',
	'Enumerations',
	'Interfaces',
	'Type Aliases',
	'Variables',
	'Namespaces',
	'Constructors',
	'Properties',
	'Accessors',
	'Methods',
	'*',
]

/**
 * File name (without extension) that full mode writes the entry point's page
 * to. Namespaces get their own pages alongside it.
 */
export const ENTRY_FILE_NAME = 'api'

/**
 * Bootstrap TypeDoc, convert the entry point, and validate the result. The
 * returned application is ready to render outputs in full mode.
 */
export async function convertProject(
	options: ProjectOptions,
): Promise<{ app: Application; project: ProjectReflection }> {
	const { entryPoint, exclude, format, groupByKind, include, outputDirectory, sort, tsconfig } =
		options

	// TypeDoc falls back to tsconfig discovery when the configured file is
	// missing, which would silently document the wrong project
	if (tsconfig !== undefined && !(await fileExists(tsconfig))) {
		throw new Error(`The tsconfig file was not found: ${tsconfig}`)
	}

	const typedocOptions: Partial<TypeDocOptions> & PluginOptions = {
		disableSources: true,
		entryPoints: [normalizePath(entryPoint)],
		exclude: ['**/node_modules/**'],
		excludeInternal: true,
		excludePrivate: true,
		excludeProtected: true,
		groupOrder: GROUP_ORDER,
		hideGenerator: true,
		// Silences TypeDoc's own console logger during bootstrap, before it can
		// be replaced with the library logger
		logLevel: 'Warn',
		readme: 'none',
		skipErrorChecking: true,
		sort,
		...(tsconfig !== undefined && { tsconfig: normalizePath(tsconfig) }),
		...(format === 'full' && {
			classPropertiesFormat: 'table',
			entryFileName: ENTRY_FILE_NAME,
			expandParameters: true,
			flattenOutputFiles: true,
			hideBreadcrumbs: true,
			hideGroupHeadings: !groupByKind,
			hidePageHeader: true,
			hidePageTitle: true,
			interfacePropertiesFormat: 'table',
			out: normalizePath(outputDirectory),
			parametersFormat: 'table',
			plugin: ['typedoc-plugin-markdown'],
			propertyMembersFormat: 'table',
			router: 'module',
			typeAliasPropertiesFormat: 'table',
			typeDeclarationFormat: 'table',
		}),
	}

	const app = await Application.bootstrapWithPlugins(typedocOptions)
	app.logger = new LibraryLogger()

	app.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
		const defaultExports = renameDefaultExport(context)
		filterExports(context.project, include, exclude, defaultExports)

		if (format === 'full') {
			qualifyNamespaceMembers(context.project)
		}
	})

	app.converter.on(Converter.EVENT_RESOLVE, (_context, reflection) => {
		dedentExamples(reflection.comment)
	})

	if (!groupByKind) {
		// Runs after TypeDoc's own group plugin, which registers at the default priority
		app.converter.on(
			Converter.EVENT_RESOLVE_END,
			(context) => {
				flattenGroups(context.project)
			},
			-1000,
		)
	}

	const project = await app.convert()
	if (project === undefined) {
		throw new Error(
			`TypeDoc could not build a project from the entry point: ${entryPoint}. See the errors logged above.`,
		)
	}

	app.validate(project)

	return { app, project }
}

/**
 * Remove top-level exports that aren't selected by the include and exclude
 * patterns. Runs before TypeDoc groups members, so the removed reflections
 * never reach the output and links to them degrade to plain text.
 */
function filterExports(
	project: ProjectReflection,
	include: string[],
	exclude: string[],
	defaultExports: Set<DeclarationReflection>,
): void {
	if (include.length === 0 && exclude.length === 0) {
		return
	}

	const unmatchedIncludes = new Set(include)
	const children = [...(project.children ?? [])]

	for (const child of children) {
		// The default export matches both its declared name and `default`
		const names = defaultExports.has(child) ? [child.name, 'default'] : [child.name]
		const matchesAny = (pattern: string) => names.some((name) => matchesPattern(pattern, name))
		const matchedIncludes = include.filter((pattern) => matchesAny(pattern))
		for (const pattern of matchedIncludes) {
			unmatchedIncludes.delete(pattern)
		}

		const isIncluded = include.length === 0 || matchedIncludes.length > 0
		const isExcluded = exclude.some((pattern) => matchesAny(pattern))

		if (isIncluded && !isExcluded) {
			continue
		}

		log.debug(`Excluding export: ${child.name}`)
		project.removeReflection(child)
	}

	for (const pattern of unmatchedIncludes) {
		log.warn(`The include pattern "${pattern}" did not match any top-level export`)
	}
}

function matchesPattern(pattern: string, name: string): boolean {
	const source = pattern
		.split('*')
		.map((part) => RegExp.escape(part))
		.join('.*')
	return new RegExp(`^${source}$`, 'v').test(name)
}

/**
 * TypeDoc names default exports `default`. Use the declaration's own name
 * instead, which matches how examples and usage sections refer to it.
 *
 * @returns The reflections that are default exports
 */
function renameDefaultExport(context: Context): Set<DeclarationReflection> {
	const defaultExports = new Set<DeclarationReflection>()
	const children = context.project.children ?? []

	for (const child of children) {
		if (child.name !== 'default') {
			continue
		}

		defaultExports.add(child)
		const localName = getLocalName(context.getSymbolFromReflection(child))
		if (localName === undefined) {
			continue
		}

		log.debug(`Documenting default export as: ${localName}`)
		child.name = localName
		renameSignatures(child, localName)

		const constructors = (child.children ?? []).filter(
			(member) => member.kind === ReflectionKind.Constructor,
		)
		for (const constructor of constructors) {
			renameSignatures(constructor, `new ${localName}`)
		}
	}

	return defaultExports
}

function renameSignatures(reflection: DeclarationReflection, name: string): void {
	const signatures = reflection.signatures ?? []
	for (const signature of signatures) {
		signature.name = name
	}
}

function getLocalName(symbol: ts.Symbol | undefined): string | undefined {
	if (symbol === undefined) {
		return undefined
	}

	if (symbol.name !== 'default') {
		return symbol.name
	}

	const declarations = symbol.declarations ?? []
	for (const declaration of declarations) {
		if (ts.isExportAssignment(declaration)) {
			if (ts.isIdentifier(declaration.expression)) {
				return declaration.expression.text
			}

			continue
		}

		const name = ts.getNameOfDeclaration(declaration)
		if (name !== undefined && ts.isIdentifier(name)) {
			return name.text
		}
	}

	return undefined
}

/**
 * Prefix namespace members with their namespace path, e.g. `things.list`. Full
 * mode flattens namespace pages into one document, and qualified names keep
 * headings unambiguous and their anchors unique.
 */
function qualifyNamespaceMembers(container: ContainerReflection, prefix?: string): void {
	const children = container.children ?? []
	for (const child of children) {
		if (prefix !== undefined) {
			child.name = `${prefix}.${child.name}`
		}

		if (child.kind === ReflectionKind.Namespace) {
			qualifyNamespaceMembers(child, child.name)
		}
	}
}

/**
 * Replace TypeDoc's kind-based groups with a single group in sorted order, so
 * that hiding group headings also stops grouping. Namespaces keep their own
 * group since the renderer emits them as an index of pages.
 */
function flattenGroups(container: ContainerReflection): void {
	const children = container.children ?? []
	if (children.length === 0) {
		return
	}

	const members = children.filter((child) => child.kind !== ReflectionKind.Namespace)
	const namespaces = children.filter((child) => child.kind === ReflectionKind.Namespace)
	const groups: ReflectionGroup[] = []

	if (members.length > 0) {
		const group = new ReflectionGroup('Members', container)
		group.children = members
		groups.push(group)
	}

	if (namespaces.length > 0) {
		const group = new ReflectionGroup('Namespaces', container)
		group.children = namespaces
		groups.push(group)
	}

	container.groups = groups

	for (const namespace of namespaces) {
		flattenGroups(namespace)
	}
}

function dedentExamples(comment: Comment | undefined): void {
	const tags = comment?.blockTags ?? []
	for (const tag of tags) {
		if (tag.tag !== '@example') {
			continue
		}

		for (const part of tag.content) {
			if (part.kind === 'code' && part.text.startsWith('```')) {
				part.text = dedentCodeBlock(part.text)
			}
		}
	}
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}
