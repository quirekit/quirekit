import { describe, expect, it, vi } from "vitest";
import type { HtmlRetainedDocumentView } from "../../document";
import { admitHtmlBlockFlow } from "./eligibility";

describe("native-flow ownership admission", () => {
  it("rejects a late complex block before reading styles across ordinary siblings", () => {
    const getComputedStyle = vi.fn(() => ({ display: "block", position: "static", cssFloat: "none", transform: "none",
      writingMode: "horizontal-tb", columnCount: "auto", columnWidth: "auto", animationName: "none",
      transitionDuration: "0s", containerType: "normal", contain: "none", contentVisibility: "visible", content: "none" }));
    const root = { ownerDocument: { defaultView: { getComputedStyle } }, parentElement: null };
    const children = Array.from({ length: 1000 }, () => ({ kind: "node", node: { isTextblock: true, textContent: "text" },
      mount: { dom: { parentNode: root, ownerDocument: root.ownerDocument, querySelectorAll: () => [] } }, children: [] }));
    children.push({ ...children[0]!, node: { isTextblock: false, textContent: "nested" } });
    const view = { root: { mount: { dom: root }, children } } as unknown as HtmlRetainedDocumentView;
    expect(admitHtmlBlockFlow(view)).toBeNull();
    expect(getComputedStyle).not.toHaveBeenCalled();
  });
});
