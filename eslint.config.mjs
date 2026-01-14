// @ts-check
import { createConfigForNuxt } from "@nuxt/eslint-config/flat"
import eslintConfigPrettier from "eslint-config-prettier"
import eslintPluginPrettier from "eslint-plugin-prettier"

export default createConfigForNuxt({
  features: {
    tooling: true,
  },
}).append([
  {
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      "prettier/prettier": "error",
      "vue/multi-word-component-names": "off",
      "vue/no-multiple-template-root": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  eslintConfigPrettier,
])
