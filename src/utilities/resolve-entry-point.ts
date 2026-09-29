import fs from 'node:fs/promises'
import path from 'node:path'
import { log } from './log'

const JS_EXTENSION_REGEX = /\.[cm]?js$/v
const DEFAULT_ENTRY_POINTS = ['src/index.ts', 'src/lib/index.ts', 'index.ts', 'lib/index.ts']

/**
 * Resolve the TypeScript entry point for a project.
 *
 * Checks in order:
 *
 * 1. The explicit `entryPoint`, relative to `cwd`
 * 2. Any path in `package.json` `exports["."]`, then `types`, `main`, and
 *    `module`, mapped back from build output to source (`./dist/index.js`
 *    becomes `./src/index.ts`)
 * 3. Common defaults: `src/index.ts`, `src/lib/index.ts`, `index.ts`,
 *    `lib/index.ts`
 *
 * @returns An absolute path
 * @throws {Error} If no entry point can be resolved
 */
export async function resolveEntryPoint(
	explicit?: string,
	cwd: string = process.cwd(),
): Promise<string> {
	if (explicit !== undefined) {
		const resolved = path.resolve(cwd, explicit)
		if (!(await fileExists(resolved))) {
			throw new Error(`Explicit entry point not found: ${explicit} (resolved to ${resolved})`)
		}

		return resolved
	}

	const candidates = await getPackageJsonCandidates(cwd)
	for (const candidate of candidates) {
		const source = await resolveToSource(candidate, cwd)
		if (source !== undefined) {
			log.debug(`Resolved package.json entry ${candidate} to ${source}`)
			return source
		}
	}

	for (const defaultPath of DEFAULT_ENTRY_POINTS) {
		const resolved = path.resolve(cwd, defaultPath)
		if (await fileExists(resolved)) {
			log.debug(`Using default entry point: ${defaultPath}`)
			return resolved
		}
	}

	throw new Error(
		`Could not resolve a TypeScript entry point in ${cwd}. Specify one explicitly: <!-- api({ entryPoint: "src/index.ts" }) -->`,
	)
}

/**
 * Collect every path-like field from package.json that could point at the
 * package's entry, in priority order.
 */
async function getPackageJsonCandidates(cwd: string): Promise<string[]> {
	let packageJson: Record<string, unknown>

	try {
		packageJson = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8')) as Record<
			string,
			unknown
		>
	} catch {
		log.debug(`No readable package.json in ${cwd}, trying default entry points`)
		return []
	}

	const { exports } = packageJson
	const dotExport =
		typeof exports === 'object' && exports !== null && '.' in exports ? exports['.'] : exports

	return [
		...collectStrings(dotExport),
		...collectStrings(packageJson.types),
		...collectStrings(packageJson.main),
		...collectStrings(packageJson.module),
	]
}

/**
 * Flatten an `exports` entry (a string or arbitrarily nested condition object)
 * into its string leaves in declaration order.
 */
function collectStrings(value: unknown): string[] {
	if (typeof value === 'string') {
		return value === '' ? [] : [value]
	}

	return typeof value === 'object' && value !== null
		? Object.values(value).flatMap((entry) => collectStrings(entry))
		: []
}

/**
 * Given a package.json entry (e.g. `./dist/lib/index.d.ts`), find the
 * corresponding source file.
 */
async function resolveToSource(entry: string, cwd: string): Promise<string | undefined> {
	const resolved = path.resolve(cwd, entry)

	if (resolved.endsWith('.ts') && !resolved.endsWith('.d.ts')) {
		return (await fileExists(resolved)) ? resolved : undefined
	}

	for (const candidate of generateSourceCandidates(resolved)) {
		if (await fileExists(candidate)) {
			return candidate
		}
	}

	return undefined
}

function generateSourceCandidates(outputPath: string): string[] {
	const sourcePath = outputPath.endsWith('.d.ts')
		? `${outputPath.slice(0, -'.d.ts'.length)}.ts`
		: outputPath.replace(JS_EXTENSION_REGEX, '.ts')
	const candidates = [sourcePath]

	// Map the output directory back to the source directory, e.g. dist/lib/index.ts → src/lib/index.ts
	const segments = sourcePath.split(path.sep)
	const distributionIndex = segments.lastIndexOf('dist')
	if (distributionIndex !== -1) {
		candidates.push(segments.with(distributionIndex, 'src').join(path.sep))
	}

	return candidates
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}
