import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Resolves a repository-relative source file for Vitest aliases.
 *
 * @param path - Repository-relative source path.
 * @returns Absolute file-system path for Vitest resolution.
 */
function sourceAlias(path: string): string {
  return fileURLToPath(new URL(`../../../${path}`, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@quirekit/core": sourceAlias("packages/core/editor/src/index.ts")
    }
  }
});
