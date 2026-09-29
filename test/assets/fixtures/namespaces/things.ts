/** Nested even deeper. */
export * as nested from './deep'

/** Options shared across things. */
export type ThingOptions = {
	/** Say more. */
	verbose?: boolean
}

/** List things. */
export function list(options?: ThingOptions): string[] {
	return options?.verbose ? ['verbose'] : []
}

/** Add a thing. */
export function add(name: string): string {
	return name
}
