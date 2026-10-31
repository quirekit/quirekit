import { fileURLToPath, URL } from "node:url";
import Vue from "unplugin-vue/vite";
import { defineConfig } from "vitest/config";

/** @param path - Repository-relative source path. @returns Absolute path for Vitest resolution. */
const source = (path: string): string => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

/** Run against MD Editor source, not a stale build of the product package. */
export default defineConfig({ plugins: [Vue()], resolve: { alias: [
  { find: "@quirekit/md-editor/vue", replacement: source("packages/md-editor/editor/src/vue/index.ts") },
] }, test: { environment: "node", include: ["src/**/*.test.ts"] } });
