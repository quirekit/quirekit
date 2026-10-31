import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  format: "esm",
  platform: "neutral",
  fixedExtension: true,
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
  outDir: "dist"
});
