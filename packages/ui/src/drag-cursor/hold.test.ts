// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { holdQuireDragCursor } from "./hold";

it("adds one document-wide rule and removes it idempotently", () => {
  const before = document.head.querySelectorAll("style").length;
  const release = holdQuireDragCursor(document);
  expect(document.head.querySelectorAll("style")).toHaveLength(before + 1);
  expect(document.head.lastElementChild?.textContent).toContain("cursor: grabbing !important");
  release();
  release();
  expect(document.head.querySelectorAll("style")).toHaveLength(before);
});
