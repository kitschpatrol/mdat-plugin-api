import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	// Loaded by tests at runtime via a path string, invisible to static analysis
	entry: ['test/assets/fixtures/sample-lib.ts'],
	// Loaded by TypeDoc at runtime via its `plugin` option
	ignoreDependencies: ['typedoc-plugin-markdown'],
})
