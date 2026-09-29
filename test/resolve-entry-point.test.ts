import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveEntryPoint } from '../src/utilities/resolve-entry-point'

const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets/fixtures')
const projectDirectory = path.join(fixturesDirectory, 'project')
const temporaryDirectories: string[] = []

async function createProject(files: Record<string, string>): Promise<string> {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mdat-plugin-api-test-'))
	temporaryDirectories.push(directory)

	for (const [file, content] of Object.entries(files)) {
		const filePath = path.join(directory, file)
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, content)
	}

	return directory
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map(async (directory) => fs.rm(directory, { force: true, recursive: true })),
	)
})

describe('resolveEntryPoint', () => {
	it('resolves an explicit entry point relative to the working directory', async () => {
		expect(await resolveEntryPoint('src/index.ts', projectDirectory)).toBe(
			path.join(projectDirectory, 'src/index.ts'),
		)
	})

	it('accepts an absolute explicit entry point', async () => {
		const entryPoint = path.join(fixturesDirectory, 'sample-lib.ts')
		expect(await resolveEntryPoint(entryPoint, os.tmpdir())).toBe(entryPoint)
	})

	it('throws for a missing explicit entry point', async () => {
		await expect(resolveEntryPoint('nope.ts', projectDirectory)).rejects.toThrow(
			'Explicit entry point not found: nope.ts',
		)
	})

	it('maps package.json exports from dist back to src', async () => {
		const directory = await createProject({
			'package.json': JSON.stringify({
				exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
			}),
			'src/index.ts': 'export {}',
		})
		expect(await resolveEntryPoint(undefined, directory)).toBe(path.join(directory, 'src/index.ts'))
	})

	it('maps a main field with a nested dist path', async () => {
		const directory = await createProject({
			'package.json': JSON.stringify({ main: './dist/lib/index.js' }),
			'src/lib/index.ts': 'export {}',
		})
		expect(await resolveEntryPoint(undefined, directory)).toBe(
			path.join(directory, 'src/lib/index.ts'),
		)
	})

	it('uses a types field that already points at source', async () => {
		const directory = await createProject({
			'lib/main.ts': 'export {}',
			'package.json': JSON.stringify({ types: './lib/main.ts' }),
		})
		expect(await resolveEntryPoint(undefined, directory)).toBe(path.join(directory, 'lib/main.ts'))
	})

	it('accepts a string exports field', async () => {
		const directory = await createProject({
			'package.json': JSON.stringify({ exports: './dist/index.js' }),
			'src/index.ts': 'export {}',
		})
		expect(await resolveEntryPoint(undefined, directory)).toBe(path.join(directory, 'src/index.ts'))
	})

	it('falls back to conventional paths without package.json', async () => {
		const directory = await createProject({ 'src/lib/index.ts': 'export {}' })
		expect(await resolveEntryPoint(undefined, directory)).toBe(
			path.join(directory, 'src/lib/index.ts'),
		)
	})

	it('ignores package.json fields that point nowhere', async () => {
		const directory = await createProject({
			'index.ts': 'export {}',
			'package.json': JSON.stringify({ main: './dist/missing.js', types: '' }),
		})
		expect(await resolveEntryPoint(undefined, directory)).toBe(path.join(directory, 'index.ts'))
	})

	it('throws when nothing resolves', async () => {
		const directory = await createProject({})
		await expect(resolveEntryPoint(undefined, directory)).rejects.toThrow(
			'Could not resolve a TypeScript entry point',
		)
	})
})
