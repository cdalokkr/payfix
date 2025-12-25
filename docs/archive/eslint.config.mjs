import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "dist/**",
      ".swc/**",
      "backups/**",
      // Project-specific ignore patterns for non-runtime assets/tests
      "tests/**",
      "scripts/**",
      "lint-output.txt",
      "lint_output_2.txt",
      "lint_output_3.txt",
      "debug-*.sql",
      "test-*.ts",
      "test-*.js",
      "verify-*.js",
      "isolated-async-button-test.tsx",
      "logout-modal-test.js",
      "mobile-number-column-test.js",
    ],
  },
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      // Basic JavaScript rules
      "no-unused-vars": "off", // Disabled for now
      "no-undef": "off", // Disabled for now
      "no-unreachable": "warn",
      "no-unreachable-loop": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // TypeScript-specific rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off", // Disabled for now
      "no-undef": "off", // Disabled for now
      "no-unreachable": "warn",
      "no-unreachable-loop": "warn",
    },
  },
];
