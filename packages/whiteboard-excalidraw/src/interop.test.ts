import { describe, expect, it } from "vitest";
import { commonJsExports } from "./interop";

describe("commonJsExports", () => {
  it("uses the namespace when the bundler copied the named exports", () => {
    const createRoot = () => undefined;
    const namespace = { createRoot, default: { createRoot } };
    expect(commonJsExports(namespace, "createRoot")).toBe(namespace);
  });

  it("falls back to the default export when only that is present", () => {
    const exports = { createRoot: () => undefined };
    const namespace = { default: exports } as unknown as typeof exports;
    expect(commonJsExports(namespace, "createRoot")).toBe(exports);
  });
});
