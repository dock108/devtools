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
// Potentially add jest plugin if needed for env: { jest: true }
// import eslintPluginJest from 'eslint-plugin-jest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  {
    // Define ignores globally
    ignores: [
      'node_modules/',
      '.next/',
      '*.d.ts',
      'coverage/',
      '.contentlayer/',
      'supabase/functions/**',
      'public/', // Ignore public assets
      '*.config.js', // Ignore JS config files at root
      '*.config.cjs',
      'lighthouserc.js',
      'jest.config.js',
      'tailwind.config.js',
    ],
  },
  {
    // Config for JS/JSX files (non-TS)
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      import: eslintPluginImport,
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      '@next/next': nextPlugin,
    },
    settings: {
      // JS-only settings if needed
      react: { version: 'detect' },
    },
    rules: {
      // Apply general JS/React rules here
      ...eslintPluginReact.configs['recommended'].rules,
      ...eslintPluginReactHooks.configs['recommended'].rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      'react/display-name': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
    },
  },
  {
    // Config for TS/TSX files (including type-aware rules)
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json'],
      },
    },
    plugins: {
      import: eslintPluginImport,
      react: eslintPluginReact,
      'react-hooks': eslintPluginReactHooks,
      '@next/next': nextPlugin,
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
      react: { version: 'detect' },
    },
    rules: {
      // Base React/Next rules (can be inherited or repeated)
      ...eslintPluginReact.configs['recommended'].rules,
      ...eslintPluginReactHooks.configs['recommended'].rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Base TS rules
      ...tsPlugin.configs['recommended'].rules,
      // Type-aware import rules
      ...eslintPluginImport.configs['typescript'].rules,

      // Rule Overrides/Customizations for TS files
      'react/display-name': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/prop-types': 'off',
      'import/no-unresolved': 'error', // Keep error for TS files initially
      'import/no-duplicates': 'error',
      'import/order': 'off',

      // TS Specific Rule Overrides
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'react/no-unknown-property': 'off',
    },
  },
  {
    // Override for Test files
    files: ['**/__tests__/**', 'tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-unresolved': 'off', // Allow unresolved imports in tests
    },
  },
  {
    // Override for Scripts
    files: ['scripts/**'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-unresolved': 'off',
    },
  },
  // Prettier must be last
  eslintConfigPrettier,
];

export default eslintConfig;
