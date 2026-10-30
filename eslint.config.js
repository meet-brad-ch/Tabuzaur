import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, chrome: "readonly" },
    },
    rules: {
      // Behaviour lives in classes, also stateless helpers (static members), never in free functions.
      "@typescript-eslint/no-extraneous-class": ["error", { allowStaticOnly: true }],
    },
  },
  {
    files: ["eslint.config.js", "tools/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
);
