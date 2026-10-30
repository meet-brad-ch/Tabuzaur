import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import sonarjs from "eslint-plugin-sonarjs";
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
      // Plain control flow and one idea per line (simple-code rules, tests too).
      "curly": ["error", "all"],
      "no-nested-ternary": "error",
      "one-var": ["error", "never"],
      "prefer-const": "error",
      "no-else-return": ["error", { allowElseIf: false }],
    },
  },
  {
    // The application code: small functions, low complexity, every member documented, no free functions.
    files: ["src/**/*.ts"],
    plugins: { jsdoc, sonarjs },
    rules: {
      "complexity": ["error", 9],
      "sonarjs/cognitive-complexity": ["error", 10],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 3],
      "max-params": ["error", 6],
      "max-statements-per-line": ["error", { max: 1 }],
      "no-restricted-syntax": [
        "error",
        { selector: "Program > FunctionDeclaration", message: "Put the function into a class." },
        { selector: "Program > ExportNamedDeclaration > FunctionDeclaration", message: "Put the function into a class." },
        { selector: "Program > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression", message: "Put the function into a class." },
      ],
      "jsdoc/require-jsdoc": ["error", {
        publicOnly: false,
        require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
        checkConstructors: true,
      }],
      "jsdoc/require-param": ["error", { checkDestructured: false }],
      "jsdoc/require-param-description": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/require-returns": ["error", { checkGetters: false }],
      "jsdoc/require-returns-description": "error",
      "jsdoc/no-types": "error",
    },
  },
  {
    files: ["eslint.config.js", "tools/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
  {
    // the tool scripts follow the same rule: stateless helpers are static members of a class
    files: ["tools/**/*.mjs"],
    rules: { "@typescript-eslint/no-extraneous-class": ["error", { allowStaticOnly: true }] },
  },
);
