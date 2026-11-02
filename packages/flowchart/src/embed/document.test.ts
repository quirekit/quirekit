import { describe, expect, it } from "vitest";
import { createFlowchartNode } from "../model/create";
import { serializeFlowchart } from "../model/document";
import { createFlowchartEmbed, parseFlowchartEmbed, prepareFlowchartSave, readFlowchartEmbed, serializeFlowchartEmbed } from "./document";

/** @returns An independent empty host object. */
const base = () => createFlowchartEmbed("flow-1");
const image = { dataUrl: "data:image/png;base64,AAAA", width: 10, height: 20 };
describe("portable flowchart embeds", () => {
  it("binds a snapshot to its exact graph and increments only the host save revision", () => {
    const original = base(), graph = { ...original.document, nodes: [createFlowchartNode("n", "decision", { x: 0, y: 0 }, "条件？")] };
    const saved = prepareFlowchartSave(original, { ...image, source: serializeFlowchart(graph) });
    expect(saved.document.nodes).toEqual(graph.nodes); expect(saved.document.revision).toBe(1);
    expect(original.document.nodes).toHaveLength(0); expect(original.preview).toBeNull();
    expect(parseFlowchartEmbed(serializeFlowchartEmbed(saved))).toEqual(saved);
  });
  it("rejects a stale snapshot instead of attaching it to another revision", () => {
    expect(() => prepareFlowchartSave(base(), { ...image, source: serializeFlowchart({ ...base().document, revision: 1 }) })).toThrow(/revision/u);
  });
  it("keeps backticks and Unicode lossless without closing a Markdown fence", () => {
    const value = { ...base(), title: "设计 ```\n😀" };
    const encoded = serializeFlowchartEmbed(value);
    expect(encoded).not.toContain("`"); expect(parseFlowchartEmbed(encoded)).toEqual(value);
  });
  it("rejects unknown fields, versions, executable URLs and excessive images", () => {
    for (const value of [{ ...base(), extra: true }, { ...base(), version: 3 }, { ...base(), title: "x".repeat(201) },
      { ...base(), preview: { ...image, dataUrl: "data:image/svg+xml;base64,AAAA" } },
      { ...base(), preview: { ...image, width: 4097 } }]) expect(() => readFlowchartEmbed(value)).toThrow();
    expect(() => parseFlowchartEmbed("x".repeat(16 * 1024 * 1024 + 1))).toThrow();
  });
  it("accepts a host-stored preview only as version 2 with a safe address, and keeps inline envelopes at version 1", () => {
    const linked = readFlowchartEmbed({ ...base(), version: 2, preview: { url: "/assets/a.png", width: 10, height: 20 } });
    expect(linked.version).toBe(2); expect(parseFlowchartEmbed(serializeFlowchartEmbed(linked))).toEqual(linked);
    expect(readFlowchartEmbed({ ...base(), version: 2, preview: image }).version).toBe(1);
    expect(readFlowchartEmbed({ ...base(), version: 2, preview: { url: "https://cdn.example.com/a.png", width: 1, height: 1 } }).preview?.url).toBe("https://cdn.example.com/a.png");
    expect(readFlowchartEmbed({ ...base(), version: 2, preview: { url: "assets/a.png", width: 1, height: 1 } }).preview?.url).toBe("assets/a.png");
    for (const url of ["javascript:alert(1)", "//evil.example/a.png", "data:image/png;base64,AAAA", "/a\"b.png", "", "../a.png", "assets/../../a.png", "#a", "assets:a.png"]) {
      expect(() => readFlowchartEmbed({ ...base(), version: 2, preview: { url, width: 1, height: 1 } })).toThrow();
    }
    expect(() => readFlowchartEmbed({ ...base(), version: 1, preview: { url: "/a.png", width: 1, height: 1 } })).toThrow();
    expect(() => readFlowchartEmbed({ ...base(), version: 2, preview: { url: "/a.png", dataUrl: image.dataUrl, width: 1, height: 1 } })).toThrow();
  });
  it("returns deeply detached immutable source", () => {
    const value = base(); expect(Object.isFrozen(value)).toBe(true); expect(Object.isFrozen(value.document)).toBe(true);
  });
});
