import Vue from "unplugin-vue/rolldown";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", settings: "src/provider-settings/validate.ts" },
  format: "esm",
  platform: "browser",
  fixedExtension: true,
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  plugins: [Vue({ isProduction: true })],
  deps: {
    neverBundle: [/^vue$/, /^@vue\//]
  }
});
