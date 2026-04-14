import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "release/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.cjs", "**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        ...globals.node,
        NodeJS: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-misused-promises": "off",
      "no-console": ["warn", { "allow": ["error", "warn"] }]
    }
  },
  {
    files: ["src/renderer/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
];
