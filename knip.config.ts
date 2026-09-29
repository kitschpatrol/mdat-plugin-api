import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	// Loaded by TypeDoc at runtime via path strings, invisible to static analysis
	entry: ['test/assets/fixtures/**/*.ts'],
})
