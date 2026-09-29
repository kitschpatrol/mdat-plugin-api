import type { ThingOptions } from './things'

/** Things you can list and add. */
export * as things from './things'

/** Top-level list, distinct from `things.list`. */
export function list(): string[] {
	return []
}

/** Uses a type from a namespace. */
export function describe(options: ThingOptions): string {
	return options.verbose ? 'verbose' : 'quiet'
}
