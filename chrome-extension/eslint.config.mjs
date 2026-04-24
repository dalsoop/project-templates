import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.mjs", "scripts/**/*.mjs"]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false
          }
        }
      ],
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowBoolean: false,
          allowNullish: false,
          allowNumber: true
        }
      ],
      "no-alert": "error",
      "no-console": [
        "error",
        {
          allow: ["warn", "error"]
        }
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Element",
          property: "innerHTML",
          message: "Do not use innerHTML in the template. Build DOM explicitly."
        },
        {
          object: "HTMLElement",
          property: "innerHTML",
          message: "Do not use innerHTML in the template. Build DOM explicitly."
        }
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../background/*", "../popup/*", "../content/*"],
              message: "Cross-layer imports are forbidden. Shared logic must live in src/shared."
            }
          ]
        }
      ]
    }
  }
);
