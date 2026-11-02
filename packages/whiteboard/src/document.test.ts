import { describe, expect, it } from "vitest";
import { createWhiteboardDocument, parseWhiteboard, prepareWhiteboardSave, serializeWhiteboard } from "./document";
import { readWhiteboardDocument, readWhiteboardScene } from "./validation";

describe("portable whiteboards", () => {
  it("roundtrips native fields and fence characters without changing the original", () => {
    const document = createWhiteboardDocument("board", "方案 ``` 中文");
    const encoded = serializeWhiteboard(document);
    expect(encoded).not.toContain("`");
    expect(parseWhiteboard(encoded)).toEqual(document);
    expect(parseWhiteboard(encoded)).not.toBe(document);
  });
  it("prepares one revision and leaves the source untouched", () => {
    const original = createWhiteboardDocument("board");
    const saved = prepareWhiteboardSave(original, original.scene, { dataUrl: "data:image/png;base64,AAAA", width: 10, height: 10 });
    expect(original.revision).toBe(0); expect(original.preview).toBeNull();
    expect(saved.revision).toBe(1); expect(saved.id).toBe(original.id);
  });
  it("rejects unknown envelopes, invalid values and external preview URLs", () => {
    const board = createWhiteboardDocument("board");
    expect(() => readWhiteboardDocument({ ...board, version: 3 })).toThrow();
    expect(() => readWhiteboardDocument({ ...board, revision: -1 })).toThrow();
    expect(() => readWhiteboardDocument({ ...board, preview: { dataUrl: "https://example.com/p.png", width: 1, height: 1 } })).toThrow();
    expect(() => readWhiteboardScene({ ...board.scene, appState: { x: Infinity } })).toThrow();
  });
  it("accepts a host-stored preview only as version 2, and writes inline boards as version 1", () => {
    const board = createWhiteboardDocument("board");
    const linked = readWhiteboardDocument({ ...board, version: 2, preview: { url: "/assets/w.png", width: 1, height: 1 } });
    expect(linked.version).toBe(2); expect(parseWhiteboard(serializeWhiteboard(linked))).toEqual(linked);
    expect(readWhiteboardDocument({ ...board, version: 2 }).version).toBe(1);
    expect(() => readWhiteboardDocument({ ...board, preview: { url: "/assets/w.png", width: 1, height: 1 } })).toThrow();
    expect(readWhiteboardDocument({ ...board, version: 2, preview: { url: "assets/w.png", width: 1, height: 1 } }).preview?.url).toBe("assets/w.png");
    for (const url of ["vbscript:x", "//evil.example/w.png", "../w.png"]) expect(() => readWhiteboardDocument({ ...board, version: 2, preview: { url, width: 1, height: 1 } })).toThrow();
  });
  it("rejects active image content, missing resources and duplicated identities", () => {
    const scene = createWhiteboardDocument("board").scene;
    expect(() => readWhiteboardScene({ ...scene, files: { a: { id: "a", dataURL: "data:image/svg+xml;base64,AAAA" } } })).toThrow();
    const element = { id: "a", type: "image", x: 0, y: 0, width: 10, height: 10, fileId: "missing" };
    expect(() => readWhiteboardScene({ ...scene, elements: [element] })).toThrow();
    expect(() => readWhiteboardScene({ ...scene, elements: [{ ...element, type: "rectangle" }, { ...element, type: "rectangle" }] })).toThrow();
  });
});
