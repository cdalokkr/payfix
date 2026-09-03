import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import typescriptEslint from 'typescript-eslint'

export default defineConfig([
  ...nextVitals,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
    },
    rules: {
      // The repository predates React Compiler lint rules. Keep the Next/React
      // baseline, but do not turn legacy patterns into CI blockers.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react/no-children-prop': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'docs/archive/**',
  ]),
])