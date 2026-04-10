import { eslintConfig } from '@kitschpatrol/eslint-config'

export default eslintConfig({
	ts: {
		overrides: {
			'depend/ban-dependencies': [
				'error',
				{
					allowed: ['execa', 'read-pkg'],
				},
			],
			// Conflicts with perfectionist...
			'ts/member-ordering': 'off',
			// 'ts/no-unsafe-type-assertion': 'off',
		},
	},
	type: 'lib',
})
