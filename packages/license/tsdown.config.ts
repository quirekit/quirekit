import { defineConfig } from "tsdown";

/** The build date bounds which releases a key's update window covers. */
export default defineConfig({
  entry: { index: "src/index.ts", "issue/index": "src/issue/index.ts", "cli/oem": "src/cli/oem/bin.ts" },
  format: "esm",
  fixedExtension: true,
  dts: true,
  clean: true,
  outDir: "dist",
  define: { __QUIREKIT_RELEASE_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) }
});
