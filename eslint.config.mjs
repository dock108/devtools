import { dirname } from 'path';
import { fileURLToPath } from 'url';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';
// @ts-expect-error - No types for eslint-plugin-react
import eslintPluginReact from 'eslint-plugin-react';
// @ts-expect-error - No types for @typescript-eslint/parser
import tsParser from '@typescript-eslint/parser';
// @ts-expect-error - No types for @typescript-eslint/eslint-plugin
import tsPlugin from '@typescript-eslint/eslint-plugin';
// Import the Next.js plugin
import nextPlugin from '@next/eslint-plugin-next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  {
    // Base config applied FIRST to all JS/TS files
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      import: eslintPluginImport,
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      '@next/next': nextPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' }, // Resolver needs project path
        node: true,
      },
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Apply general rules (non-type-aware) here
      ...eslintPluginImport.configs['recommended'].rules,
      ...eslintPluginReact.configs['recommended'].rules,
      ...eslintPluginReactHooks.configs['recommended'].rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      'import/order': 'off',
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',
      'react/display-name': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // TypeScript specific config (type-aware rules)
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'], // Apply project setting only for TS files
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      // Need import plugin here too for type-aware import rules
      import: eslintPluginImport,
    },
    rules: {
      // Apply TS-specific and type-aware rules
      ...tsPlugin.configs['recommended'].rules,
      ...eslintPluginImport.configs['typescript'].rules, // Type-aware import rules

      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/ban-ts-comment': 'error',
      // Disable non-type-aware import/no-unresolved here as it's handled above
      // and the type-aware version is included via plugin configs
      'import/no-unresolved': 'off',
    },
  },
  {
    // Override for test files
    files: ['**/__tests__/**', 'tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // 'import/no-unresolved': 'off', // Already off from TS specific config?
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off', // Allow require in tests
    },
  },
  {
    // Override for script files
    files: ['scripts/**'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Override for JS config files
    files: [
      '**/*.config.js',
      '**/*.config.cjs',
      'lighthouserc.js',
      'jest.config.js',
      'tailwind.config.js',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-unresolved': 'off',
    },
  },
  // Apply Prettier last
  eslintConfigPrettier,
];

export default eslintConfig;
