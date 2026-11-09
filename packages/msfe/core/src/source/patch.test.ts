import { describe, expect, it } from "vitest";
import { syntaxTree } from "@quirekit/cm-language";
import { createDocumentState } from "../mount/state";
import { sourceDocument, sourceNode } from "./authoring/adapter";
import { patchSourceDestination } from "./patch";
import { isSafeDestination, readSourceDestination } from "./destination";
import type { DestinationPatch } from "./types";

/** @param source - Exact Markdown. @param patch - Semantic changes. @returns Applied source and decoded destination. */
function patched(source: string, patch: DestinationPatch) {
  const state = createDocumentState(source, []), node = syntaxTree(state).topNode.firstChild!.firstChild!;
  const changes = patchSourceDestination(sourceDocument(state), sourceNode(node), patch)!;
  expect(changes).not.toBeNull();
  const next = state.update({ changes }).state;
  return { text: next.doc.toString(), destination: readSourceDestination(sourceDocument(next), sourceNode(syntaxTree(next).topNode.firstChild!.firstChild!)) };
}

describe("semantic destination writing", () => {
  it("preserves untouched inline bytes and round-trips escaped fields", () => {
    const original = '[**A**](old\t\'old title\')';
    const result = patched(original, { url: '/a(b)?x=&copy;', title: "It's &amp; \\ nice" });
    expect(result.text).toBe('[**A**](/a\\(b\\)?x=&amp;copy;\t\'It\\\'s &amp;amp; \\\\ nice\')');
    expect(result.destination).toMatchObject({ url: "/a(b)?x=&copy;", title: "It's &amp; \\ nice" });
  });
  it("materializes only one reference usage while preserving formatted labels and shared definitions", () => {
    const source = '[**A**][id] and [B][id]\n\n[id]: /old "Title"';
    expect(patched(source, { url: "/new" }).text).toBe('[**A**](/new "Title") and [B][id]\n\n[id]: /old "Title"');
    const image = patched('![alt][id]\n\n[id]: /img.png "T"', { label: '[new] &amp;', title: '"quote"' });
    expect(image.destination).toMatchObject({ url: "/img.png", title: '"quote"' });
    expect(image.text).toContain('![\\[new\\] &amp;amp;]');
  });
  it("handles angle and bare automatic links without wrapping destination child tokens", () => {
    expect(patched('<https://example.com?a=&copy;>', { url: '/new' }).text).toBe('[https://example.com?a=&amp;copy;](/new)');
    expect(patched('www.example.com', { url: '/new' }).text).toBe('[www.example.com](/new)');
  });
  it("rejects active destinations after entity decoding instead of hiding control characters with URI encoding", () => {
    for (const url of ['jav&#x61;script:alert(1)', 'java&#10;script:alert(1)', 'data:text/html,x']) {
      const result = patched(`[x](<${url}>)`, { title: 'x' });
      expect(isSafeDestination(result.destination!.url)).toBe(false);
    }
  });
});
