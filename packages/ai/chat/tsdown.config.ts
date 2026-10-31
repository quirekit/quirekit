import { fileURLToPath } from "node:url";
import Vue from "unplugin-vue/rolldown";
import { defineConfig } from "tsdown";

const packageSourceRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  entry: { index: "src/index.ts", vue: "src/vue/index.ts" },
  format: "esm",
  platform: "browser",
  fixedExtension: true,
  dts: { vue: true },
  minify: true,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  alias: { "@ai-chat": packageSourceRoot },
  plugins: [Vue({ isProduction: true })],
  deps: {
    neverBundle: [/^vue$/, /^@vue\//],
    dts: { neverBundle: [/^vue$/, /^@vue\//] }
  }
});
