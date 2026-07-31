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
			// Allow the TSDoc-standard defaultValue tag, which TypeDoc renders as a
			// "Default value" table column
			'jsdoc/check-tag-names': ['error', { definedTags: ['defaultValue', 'public'] }],
			// Conflicts with perfectionist...
			'ts/member-ordering': 'off',
			// 'ts/no-unsafe-type-assertion': 'off',
		},
	},
	type: 'lib',
})
