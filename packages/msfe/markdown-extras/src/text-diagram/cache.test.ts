// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { textDiagramPreviewCache as cache } from "./cache";
import type { PreviewProps } from "../shared/types";

/** @param text - Exact body identity. @param language - Explicit grammar. @returns Minimal source-bound inputs, with no persisted preview. */
function props(text: string, language: "plantuml" | "dot" = "dot"): PreviewProps {
  return { kind: "textDiagram", language, text, source: text, range: { from: 0, to: text.length }, readOnly: false, target: () => ({ reveal: () => true, release: () => {} }) };
}

describe("source-font diagram preview cache", () => {
  it("matches exact body, language and owner but not source offsets or permissions", () => {
    const owner = document.implementation.createHTMLDocument(), input = props("digraph { a -> b }");
    cache.set(input, owner, "<svg>accepted</svg>");
    expect(cache.get({ ...input, readOnly: true, range: { from: 20, to: 40 }, source: "> fenced source" }, owner)).toBe("<svg>accepted</svg>");
    expect(cache.get(props(input.text + " "), owner)).toBeUndefined();
    expect(cache.get(props(input.text, "plantuml"), owner)).toBeUndefined();
    expect(cache.get(input, document)).toBeUndefined();
    const mermaid: PreviewProps = { ...input, kind: "mermaid", language: "mermaid" };
    cache.set(mermaid, owner, "<svg>host-font</svg>"); expect(cache.get(mermaid, owner)).toBeUndefined();
  });

  it("keys Mermaid by the host font role it was laid out with", () => {
    const owner = document.implementation.createHTMLDocument(), mermaid: PreviewProps = { ...props("graph TD\nA-->B"), kind: "mermaid", language: "mermaid" };
    const font = { fontFamily: "Inter, sans-serif", fontSize: 16 };
    cache.set(mermaid, owner, "<svg>mermaid</svg>", font);
    expect(cache.get(mermaid, owner, { ...font })).toBe("<svg>mermaid</svg>");
    expect(cache.get(mermaid, owner, { ...font, fontSize: 18 })).toBeUndefined();
    expect(cache.get(mermaid, owner, { ...font, fontFamily: "serif" })).toBeUndefined();
    expect(cache.get(mermaid, owner)).toBeUndefined();
  });

  it("evicts the oldest entry while promoting actual reads", () => {
    const owner = document.implementation.createHTMLDocument();
    for (let index = 0; index < 32; index++) cache.set(props(String(index)), owner, "<svg/>");
    expect(cache.get(props("0"), owner)).toBe("<svg/>"); cache.set(props("32"), owner, "<svg/>");
    expect(cache.get(props("1"), owner)).toBeUndefined(); expect(cache.get(props("0"), owner)).toBe("<svg/>");
  });

  it("bounds total text and rejects oversized output without truncation", () => {
    const owner = document.implementation.createHTMLDocument(), html = "x".repeat(400_000);
    for (let index = 0; index < 3; index++) cache.set(props(String(index)), owner, html);
    expect(cache.get(props("0"), owner)).toBeUndefined(); expect(cache.get(props("1"), owner)).toBe(html);
    cache.set(props("large"), owner, "x".repeat(1024 * 1024 + 1)); expect(cache.get(props("large"), owner)).toBeUndefined();
    expect(cache.get(props("2"), owner)).toBe(html);
  });
});
