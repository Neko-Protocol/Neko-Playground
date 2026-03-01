import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** ESLint flat config: Next core-web-vitals + TypeScript, no FlatCompat (avoids circular ref in validator). */
const eslintConfig = [
	...nextCoreWebVitals,
	...nextTypescript,
	{
		rules: {
			// Prefixing a parameter with _ is the established convention for
			// "intentionally unused" (e.g., interface implementations, callbacks).
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
		},
	},
	{
		ignores: [
			"node_modules/**",
			".next/**",
			"out/**",
			"build/**",
			"next-env.d.ts",
		],
	},
];

export default eslintConfig;

