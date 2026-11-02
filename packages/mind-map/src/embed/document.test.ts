import { describe, expect, it } from "vitest";
import { serializeMindMap } from "../model/document";
import { createMindMapDocument } from "../outline/create";
import { createMindMapEmbed, parseMindMapEmbed, prepareMindMapSave, readMindMapEmbed, serializeMindMapEmbed } from "./document";

const preview = { dataUrl: "data:image/png;base64,AAAA", width: 100, height: 60 };
describe("source-bound mind map embeds", () => {
  it("saves the exact snapshot tree, free topics and one revision without changing the original", () => {
    const original = createMindMapEmbed("one");
    const document = { ...createMindMapDocument({ text: "项目计划", children: [{ text: "研发", children: [] }] }),
      floatingTopics: [{ root: { id: "free", text: "独立想法", collapsed: false, children: [] }, position: { x: 120, y: 90 }, side: "right" as const }] };
    const saved = prepareMindMapSave(original, { ...preview, source: serializeMindMap(document) });
    expect(saved.document.root.text).toBe("项目计划"); expect(saved.document.floatingTopics).toEqual(document.floatingTopics);
    expect(saved.document.revision).toBe(1); expect(original.document.revision).toBe(0); expect(original.preview).toBeNull();
    expect(parseMindMapEmbed(serializeMindMapEmbed(saved))).toEqual(saved);
    expect(Object.isFrozen(saved.document.root.children)).toBe(true);
  });
  it("rejects stale source instead of attaching its preview to a different revision", () => {
    const original = createMindMapEmbed("one");
    expect(() => prepareMindMapSave(original, { ...preview, source: serializeMindMap({ ...original.document, revision: 9 }) })).toThrow(/revision/);
  });
  it("preserves Unicode and backticks inside the exclusive Markdown fence", () => {
    const original = { ...createMindMapEmbed("one"), title: "中文 ```\n🧠" };
    const encoded = serializeMindMapEmbed(original);
    expect(encoded).not.toContain("`"); expect(parseMindMapEmbed(encoded)).toEqual(original);
  });
  it("refuses unknown versions, fields, URLs, invalid dimensions and excessive source", () => {
    const base = createMindMapEmbed("one");
    for (const value of [{ ...base, type: "unknown" }, { ...base, version: 3 }, { ...base, unknown: true },
      { ...base, preview: { ...preview, dataUrl: "https://example.com/tracker.png" } },
      { ...base, preview: { ...preview, width: 5000 } }, { ...base, id: "" }, { ...base, title: "x".repeat(201) }]) {
      expect(() => readMindMapEmbed(value)).toThrow();
    }
    expect(() => parseMindMapEmbed(" ".repeat(16 * 1024 * 1024 + 1))).toThrow();
  });
  it("accepts a host-stored preview only as version 2 with a safe address", () => {
    const base = createMindMapEmbed("one");
    const linked = readMindMapEmbed({ ...base, version: 2, preview: { url: "/assets/m.png", width: 10, height: 20 } });
    expect(linked.version).toBe(2); expect(parseMindMapEmbed(serializeMindMapEmbed(linked))).toEqual(linked);
    expect(() => readMindMapEmbed({ ...base, version: 1, preview: { url: "/assets/m.png", width: 10, height: 20 } })).toThrow();
    expect(readMindMapEmbed({ ...base, version: 2, preview: { url: "assets/m.png", width: 10, height: 20 } }).preview?.url).toBe("assets/m.png");
    for (const url of ["javascript:alert(1)", "//evil.example/m.png", "../m.png"]) expect(() => readMindMapEmbed({ ...base, version: 2, preview: { url, width: 10, height: 20 } })).toThrow();
  });
});
