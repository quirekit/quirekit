import { expect, it } from "vitest";
import { anchorsChanged } from "./anchors";

it("treats a submitted draft replaced by its thread as a change, and ignores sub-pixel jitter", () => {
  const draft = new Map([["a", 10], ["draft", 245]]);
  expect(anchorsChanged(draft, new Map([["a", 10], ["thread-1", 245]]))).toBe(true);
  expect(anchorsChanged(draft, new Map([["a", 10.2], ["draft", 245.3]]))).toBe(false);
  expect(anchorsChanged(draft, new Map([["a", 12], ["draft", 245]]))).toBe(true);
  expect(anchorsChanged(draft, new Map([["a", 10]]))).toBe(true);
});
