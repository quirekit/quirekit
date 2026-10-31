import Vue from "unplugin-vue/rolldown";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm", fixedExtension: true, dts: { vue: true }, clean: true,
  plugins: [Vue({ isProduction: true })],
  deps: { neverBundle: [/^vue$/, /^@vue\//], dts: { neverBundle: [/^vue$/, /^@vue\//] } },
});
