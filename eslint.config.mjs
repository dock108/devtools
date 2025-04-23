import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";
// @ts-expect-error - No types for eslint-plugin-react
import eslintPluginReact from "eslint-plugin-react";
// @ts-expect-error - No types for @typescript-eslint/parser
import tsParser from "@typescript-eslint/parser";
// @ts-expect-error - No types for @typescript-eslint/eslint-plugin
import tsPlugin from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Base config for JS/TS files
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: eslintPluginImport,
      react: eslintPluginReact,
      "react-hooks": eslintPluginReactHooks,
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
      react: {
        version: "detect", // Automatically detect React version
      },
    },
    rules: {
      ...tsPlugin.configs["recommended"].rules,
      ...eslintPluginImport.configs["recommended"].rules,
      ...eslintPluginImport.configs["typescript"].rules,
      ...eslintPluginReact.configs["recommended"].rules,
      ...eslintPluginReactHooks.configs["recommended"].rules,
      // Custom rules
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      // Soften noisy rules to warnings
      "import/no-unresolved": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-require-imports": "warn",
      "react/display-name": "off",
    },
  },
  // Override for test and deno function files – turn off import order/unresolved
  {
    files: ["**/__tests__/**", "tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "supabase/functions/**/*.ts"],
    rules: {
      "import/order": "off",
      "import/no-unresolved": "off",
    },
  },
  // Next.js specific config (applied on top)
  ...compat.extends("next/core-web-vitals"),
  // Prettier config (must be last to override others)
  eslintConfigPrettier, // Disables rules that conflict with Prettier
  // Final override to ensure import/order never fails CI
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "import/order": "off",
    },
  },
];

export default eslintConfig;
