type GlobalOptions = {
	dryRun: boolean
	namespace: string
	verbose: boolean
}

/** Options for cleaning, derived from options that aren't exported. */
export type CleanOptions = Pick<GlobalOptions, 'dryRun' | 'namespace'>

/** Alias of a type that isn't exported. */
export type Options = GlobalOptions

/** A generic wrapper. */
export type Wrapped<T> = {
	/** The wrapped value. */
	value: T
	/** Always true. */
	wrapped: true
}

/** A template literal type. */
export type EventName = `on${string}`

/** Takes a type that isn't exported, so TypeDoc can't link it. */
export function useHidden(options: GlobalOptions): GlobalOptions {
	return options
}

// eslint-disable-next-line jsdoc/require-jsdoc
export function undocumented(a: string, b?: number): boolean {
	return b === undefined ? a === '' : a.length > b
}

/** Overloaded for strings. */
export function overloaded(value: string): string
/** Overloaded for numbers. */
export function overloaded(value: number): number
export function overloaded(value: number | string): number | string {
	return value
}

/** Inline object parameter with a callback and a nested object. */
export function configure(options: {
	name: string
	nested: { deep: boolean }
	onChange?: (value: number) => void
}): string {
	return options.name
}

/** A function-typed variable. */
export const shout = (text: string): string => text.toUpperCase()

/** Reads and writes files. */
// eslint-disable-next-line ts/consistent-type-definitions
export interface Adapter {
	/** Adapter name. */
	readonly name: string
	/** Read a file. */
	read(path: string): Promise<string>
	/** Optionally write a file. */
	write?(path: string, content: string): Promise<void>
}

/** Nested object types inside type arguments. */
export const deep: Promise<{ items: Array<{ id: string }>; meta: { count: number } }> =
	Promise.resolve({ items: [], meta: { count: 0 } })

/** Property names that aren't identifiers. */
export type Quoted = {
	/** Needs quotes. */
	'file name': string
}
