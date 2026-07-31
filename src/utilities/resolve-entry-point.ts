import fs from 'node:fs/promises'
import path from 'node:path'
import { log } from './log'

const JS_EXTENSION_REGEX = /\.[cm]?js$/v

/**
 * Resolve the TypeScript entry point for a project.
 *
 * Checks in order:
 *
 * 1. Explicit `entryPoint` option
 * 2. `package.json` exports["."].types
 * 3. `package.json` exports["."].import → resolve .ts equivalent
 * 4. `package.json` types field
 * 5. `package.json` main field → resolve .ts equivalent
 * 6. Common defaults: src/index.ts, src/lib/index.ts
 *
 * @throws {Error} If no entry point can be resolved
 */
export async function resolveEntryPoint(explicit?: string): Promise<string> {
	if (explicit !== undefined) {
		const resolved = path.resolve(explicit)
		await assertFileExists(resolved, `Explicit entry point not found: ${explicit}`)
		return resolved
	}

	// Try to read package.json
	const packageJsonPath = path.resolve('package.json')
	let packageJson: Record<string, unknown> | undefined

	try {
		const raw = await fs.readFile(packageJsonPath, 'utf8')
		packageJson = JSON.parse(raw) as Record<string, unknown>
	} catch {
		log.debug('No package.json found, trying defaults')
	}

	if (packageJson !== undefined) {
		const exports = packageJson.exports as Record<string, unknown> | undefined
		// Convert a possible JSON null to undefined
		const dotExport = (exports?.['.'] ?? undefined) as Record<string, string> | string | undefined

		// Try exports["."] types and import, then top-level types and main fields
		const fieldCandidates: Array<string | undefined> =
			typeof dotExport === 'object' ? [dotExport.types, dotExport.import] : []

		fieldCandidates.push(
			packageJson.types as string | undefined,
			packageJson.main as string | undefined,
		)

		for (const fieldValue of fieldCandidates) {
			if (fieldValue === undefined || fieldValue === '') {
				continue
			}

			const tsPath = await resolveToSource(fieldValue)
			if (tsPath !== undefined) {
				return tsPath
			}
		}
	}

	// Try common defaults
	const defaults = ['src/index.ts', 'src/lib/index.ts', 'index.ts', 'lib/index.ts']
	for (const defaultPath of defaults) {
		const resolved = path.resolve(defaultPath)
		if (await fileExists(resolved)) {
			log.debug(`Using default entry point: ${defaultPath}`)
			return resolved
		}
	}

	throw new Error(
		'Could not resolve TypeScript entry point. Specify one explicitly: <!-- api({entryPoint: "src/index.ts"}) -->',
	)
}

/**
 * Given a dist/output path (e.g. ./dist/lib/index.d.ts or ./dist/lib/index.js),
 * try to find the corresponding source .ts file.
 */
async function resolveToSource(outputPath: string): Promise<string | undefined> {
	const resolved = path.resolve(outputPath)

	// If it's already a .ts file and exists, use it directly
	if (resolved.endsWith('.ts') && !resolved.endsWith('.d.ts') && (await fileExists(resolved))) {
		return resolved
	}

	// Try replacing dist/ with src/ and .d.ts/.js with .ts
	const candidates = generateSourceCandidates(resolved)

	for (const candidate of candidates) {
		if (await fileExists(candidate)) {
			log.debug(`Resolved ${outputPath} → ${candidate}`)
			return candidate
		}
	}

	return undefined
}

/**
 * Generate candidate source paths from a dist/output path.
 */
function generateSourceCandidates(distributionPath: string): string[] {
	const candidates: string[] = []

	// Normalize the path: strip .d.ts → .ts, .js → .ts
	let tsPath = distributionPath
	if (tsPath.endsWith('.d.ts')) {
		tsPath = tsPath.slice(0, -5) + '.ts'
	} else if (tsPath.endsWith('.js') || tsPath.endsWith('.mjs') || tsPath.endsWith('.cjs')) {
		tsPath = tsPath.replace(JS_EXTENSION_REGEX, '.ts')
	}

	candidates.push(tsPath)

	// Try replacing /dist/ with /src/
	if (tsPath.includes('/dist/')) {
		candidates.push(tsPath.replace('/dist/', '/src/'))
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

async function assertFileExists(filePath: string, message: string): Promise<void> {
	if (!(await fileExists(filePath))) {
		throw new Error(message)
	}
}
