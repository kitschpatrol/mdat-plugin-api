import type {
	CommentDisplayPart,
	ContainerReflection,
	DeclarationReflection,
	ParameterReflection,
	ProjectReflection,
	SignatureReflection,
	SomeType,
	TypeParameterReflection,
} from 'typedoc'
import { ReflectionKind } from 'typedoc'
import { codeSpan, escapeTableCell } from './markdown'

/**
 * Options for the compact renderer.
 */
export type CompactOptions = {
	/** Whether to render one table per kind under a heading, or a single table. */
	groupByKind: boolean
	/** Heading level for group and namespace headings. */
	headingLevel: number
}

type Row = {
	description: string
	name: string
	type: string
}

type KindTable = {
	columns: [string, string]
	kind: ReflectionKind
	title: string
}

/** One table per kind, in output order, with kind-specific column labels. */
const KIND_TABLES: KindTable[] = [
	{ columns: ['Function', 'Returns'], kind: ReflectionKind.Function, title: 'Functions' },
	{ columns: ['Class', 'Constructor'], kind: ReflectionKind.Class, title: 'Classes' },
	{ columns: ['Enumeration', 'Members'], kind: ReflectionKind.Enum, title: 'Enumerations' },
	{ columns: ['Interface', 'Definition'], kind: ReflectionKind.Interface, title: 'Interfaces' },
	{ columns: ['Type', 'Definition'], kind: ReflectionKind.TypeAlias, title: 'Type Aliases' },
	{ columns: ['Variable', 'Type'], kind: ReflectionKind.Variable, title: 'Variables' },
]

const TABLE_KINDS = new Set(KIND_TABLES.map((table) => table.kind))
const PARAGRAPH_BREAK_REGEX = /\n\s*\n/v
const IDENTIFIER_REGEX = /^[\p{ID_Start}$_][\p{ID_Continue}$]*$/v

/**
 * Render one table row per export, with a subsection per namespace. Reads the
 * TypeDoc reflection model directly, so it doesn't need
 * typedoc-plugin-markdown.
 */
export function renderCompact(project: ProjectReflection, options: CompactOptions): string {
	return renderContainer(project, [], options.headingLevel, options.groupByKind).join('\n\n')
}

function renderContainer(
	container: ContainerReflection,
	namespacePath: string[],
	level: number,
	groupByKind: boolean,
): string[] {
	const children = container.children ?? []
	const sections: string[] = []

	if (groupByKind) {
		for (const table of KIND_TABLES) {
			const rows = children
				.filter((child) => child.kind === table.kind)
				.flatMap((child) => toRows(child))

			if (rows.length > 0) {
				sections.push(
					`${heading(level, table.title)}\n\n${renderTable([...table.columns, 'Description'], rows)}`,
				)
			}
		}
	} else {
		const rows = children
			.filter((child) => TABLE_KINDS.has(child.kind))
			.flatMap((child) => toRows(child))

		if (rows.length > 0) {
			sections.push(renderTable(['Export', 'Type', 'Description'], rows))
		}
	}

	for (const child of children) {
		if (child.kind !== ReflectionKind.Namespace) {
			continue
		}

		const childPath = [...namespacePath, child.name]
		sections.push(
			[
				heading(level, childPath.join('.')),
				summaryToText(child.comment?.summary),
				...renderContainer(child, childPath, level + 1, groupByKind),
			]
				.filter((section) => section !== '')
				.join('\n\n'),
		)
	}

	return sections
}

function toRows(reflection: DeclarationReflection): Row[] {
	const description = summaryToText(reflection.comment?.summary)

	if (reflection.kind === ReflectionKind.Function) {
		return (reflection.signatures ?? []).map((signature) => ({
			description: summaryToText(signature.comment?.summary ?? reflection.comment?.summary),
			name: renderSignature(reflection.name, signature),
			type: typeToString(signature.type),
		}))
	}

	if (reflection.kind === ReflectionKind.Class) {
		return [
			{
				description,
				name: nameWithTypeParameters(reflection),
				type: constructorToString(reflection),
			},
		]
	}

	if (reflection.kind === ReflectionKind.Enum) {
		return [
			{
				description,
				name: reflection.name,
				type: (reflection.children ?? []).map((member) => member.name).join(', '),
			},
		]
	}

	if (reflection.kind === ReflectionKind.Interface) {
		return [
			{
				description,
				name: nameWithTypeParameters(reflection),
				type: declarationToString(reflection, 0),
			},
		]
	}

	if (reflection.kind === ReflectionKind.TypeAlias) {
		// TypeDoc hoists object literal members onto the alias itself
		return [
			{
				description,
				name: nameWithTypeParameters(reflection),
				type:
					reflection.type === undefined
						? declarationToString(reflection, 0)
						: typeToString(reflection.type),
			},
		]
	}

	return reflection.kind === ReflectionKind.Variable
		? [{ description, name: reflection.name, type: typeToString(reflection.type) }]
		: []
}

function heading(level: number, text: string): string {
	return `${'#'.repeat(level)} ${text}`
}

function renderTable(columns: string[], rows: Row[]): string {
	const header = `| ${columns.join(' | ')} |`
	const divider = `| ${columns.map(() => '---').join(' | ')} |`
	const body = rows.map((row) => {
		const type = row.type === '' ? '' : escapeTableCell(codeSpan(row.type))
		return `| ${escapeTableCell(codeSpan(row.name))} | ${type} | ${row.description} |`
	})

	return [header, divider, ...body].join('\n')
}

function nameWithTypeParameters(reflection: DeclarationReflection): string {
	return `${reflection.name}${typeParametersToString(reflection.typeParameters)}`
}

function constructorToString(reflection: DeclarationReflection): string {
	const constructor = reflection.children?.find(
		(child) => child.kind === ReflectionKind.Constructor,
	)
	const signature = constructor?.signatures?.[0]

	return signature === undefined
		? `new ${reflection.name}()`
		: renderSignature(`new ${reflection.name}`, signature)
}

function renderSignature(name: string, signature: SignatureReflection): string {
	return `${name}${typeParametersToString(signature.typeParameters)}(${parametersToString(signature.parameters)})`
}

function typeParametersToString(typeParameters: TypeParameterReflection[] | undefined): string {
	return typeParameters === undefined || typeParameters.length === 0
		? ''
		: `<${typeParameters.map((parameter) => parameter.name).join(', ')}>`
}

function parametersToString(parameters: ParameterReflection[] | undefined): string {
	return (parameters ?? [])
		.map((parameter) => {
			const rest = parameter.flags.isRest ? '...' : ''
			const optional = parameter.flags.isOptional || parameter.defaultValue !== undefined ? '?' : ''
			return `${rest}${parameter.name}${optional}: ${typeToString(parameter.type)}`
		})
		.join(', ')
}

/**
 * Stringify a type the way it would appear in source. Object literal types are
 * expanded one level deep; anything nested deeper is summarized as `object` to
 * keep table cells readable. TypeDoc's own `toString` expands without limit, so
 * composite types are walked here and only leaf types fall through to it.
 */
function typeToString(type: SomeType | undefined, depth = 0): string {
	if (type === undefined) {
		return 'unknown'
	}

	if (type.type === 'array') {
		return `${wrapCompound(type.elementType, depth)}[]`
	}

	if (type.type === 'indexedAccess') {
		return `${typeToString(type.objectType, depth)}[${typeToString(type.indexType, depth)}]`
	}

	if (type.type === 'intersection') {
		return type.types.map((member) => wrapCompound(member, depth)).join(' & ')
	}

	if (type.type === 'namedTupleMember') {
		return `${type.name}${type.isOptional ? '?' : ''}: ${typeToString(type.element, depth)}`
	}

	if (type.type === 'optional') {
		return `${wrapCompound(type.elementType, depth)}?`
	}

	if (type.type === 'reference') {
		return `${type.name}${typeArgumentsToString(type.typeArguments, depth)}`
	}

	if (type.type === 'reflection') {
		return declarationToString(type.declaration, depth)
	}

	if (type.type === 'rest') {
		return `...${typeToString(type.elementType, depth)}`
	}

	if (type.type === 'tuple') {
		return `[${type.elements.map((element) => typeToString(element, depth)).join(', ')}]`
	}

	return type.type === 'union'
		? type.types.map((member) => wrapFunction(member, depth)).join(' | ')
		: type.toString()
}

/**
 * Parenthesize unions, intersections, and function types when they appear where
 * operator precedence would otherwise change their meaning.
 */
function wrapCompound(type: SomeType, depth: number): string {
	const text = typeToString(type, depth)
	return type.type === 'union' || type.type === 'intersection' || isFunctionType(type)
		? `(${text})`
		: text
}

function wrapFunction(type: SomeType, depth: number): string {
	const text = typeToString(type, depth)
	return isFunctionType(type) ? `(${text})` : text
}

function isFunctionType(type: SomeType): boolean {
	return (
		type.type === 'reflection' &&
		type.declaration.signatures !== undefined &&
		type.declaration.signatures.length > 0 &&
		(type.declaration.children ?? []).length === 0 &&
		(type.declaration.indexSignatures ?? []).length === 0
	)
}

function typeArgumentsToString(typeArguments: SomeType[] | undefined, depth: number): string {
	return typeArguments === undefined || typeArguments.length === 0
		? ''
		: `<${typeArguments.map((argument) => typeToString(argument, depth)).join(', ')}>`
}

function declarationToString(declaration: DeclarationReflection, depth: number): string {
	const children = declaration.children ?? []
	const indexSignatures = declaration.indexSignatures ?? []
	const [signature] = declaration.signatures ?? []

	if (signature !== undefined && children.length === 0 && indexSignatures.length === 0) {
		return `${typeParametersToString(signature.typeParameters)}(${parametersToString(signature.parameters)}) => ${typeToString(signature.type, depth)}`
	}

	if (depth > 0) {
		return 'object'
	}

	const members = [
		...indexSignatures.map((indexSignature) => indexSignatureToString(indexSignature, depth + 1)),
		...children.map((child) => memberToString(child, depth + 1)),
	]

	return members.length === 0 ? '{}' : `{ ${members.join('; ')} }`
}

function indexSignatureToString(signature: SignatureReflection, depth: number): string {
	const key = signature.parameters?.[0]
	return `[${key?.name ?? 'key'}: ${typeToString(key?.type, depth)}]: ${typeToString(signature.type, depth)}`
}

function memberToString(member: DeclarationReflection, depth: number): string {
	const name = IDENTIFIER_REGEX.test(member.name) ? member.name : JSON.stringify(member.name)
	const optional = member.flags.isOptional ? '?' : ''
	const methodSignature = member.signatures?.[0]

	return methodSignature !== undefined && member.kind === ReflectionKind.Method
		? `${name}${optional}${typeParametersToString(methodSignature.typeParameters)}(${parametersToString(methodSignature.parameters)}): ${typeToString(methodSignature.type, depth)}`
		: `${name}${optional}: ${typeToString(member.getSignature?.type ?? member.type, depth)}`
}

/**
 * Reduce a comment summary to its first paragraph as a single line of Markdown,
 * suitable for a table cell.
 */
function summaryToText(parts: CommentDisplayPart[] | undefined): string {
	const text = (parts ?? []).map((part) => partToText(part)).join('')
	const firstParagraph = text.trim().split(PARAGRAPH_BREAK_REGEX)[0] ?? ''
	return escapeTableCell(firstParagraph)
}

function partToText(part: CommentDisplayPart): string {
	return part.kind === 'inline-tag' ? codeSpan(part.tsLinkText ?? part.text) : part.text
}
