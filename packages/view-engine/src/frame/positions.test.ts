import { createEditor } from "@quirekit/core";
import { Transform } from "@quirekit/pm";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it } from "vitest";
import { createQuireViewEngineRuntime } from "./runtime";

const viewportRect = { x: 0, y: 0, width: 480, height: 300 };

/** @returns Editor with two paragraphs "Hello" and "world". */
function createFixture() {
  return createEditor({
    extensions: [StarterKit.configure({ undoRedo: false })],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "world" }] }
      ]
    }
  });
}

// Public geometry takes canonical positions while the frame document carries speculative content.
describe("canonical position mapping of a frame", () => {
  it("is absent when the frame shows the committed document", () => {
    const frame = createQuireViewEngineRuntime({ editor: createFixture() }).buildFrame({ viewportRect });
    expect(frame.canonicalPositionMapping).toBeUndefined();
  });

  it("moves positions after an IME preedit by its length, onto the same characters", () => {
    const editor = createFixture();
    const frame = createQuireViewEngineRuntime({ editor }).buildFrame({
      viewportRect,
      imePreedit: { range: { from: 6, to: 6 }, text: "wo'jue'de" }
    });
    const mapping = frame.canonicalPositionMapping!;
    const doc = frame.layoutSnapshot.state.doc;
    // "w" of "world" sits at 8 in the committed document.
    expect(doc.textBetween(mapping.map(8), mapping.map(8) + 5)).toBe("world");
    expect(mapping.map(3)).toBe(3);
    // A caret at the composition point stays before or after the preedit by its side.
    expect(mapping.map(6, -1)).toBe(6);
    expect(mapping.map(6, 1)).toBe(6 + "wo'jue'de".length);
    // A frame position inside the preedit maps back to the composition point.
    expect(mapping.invert().map(9)).toBe(6);
  });

  it("follows presentation overlay steps before the preedit", () => {
    const editor = createFixture();
    const baseDoc = editor.state.doc;
    const steps = new Transform(baseDoc).insert(1, editor.schema.text("Say ")).steps;
    const frame = createQuireViewEngineRuntime({ editor }).buildFrame({
      viewportRect,
      presentationOverlay: { baseDoc, steps, ranges: [{ from: 1, to: 5, role: "inserted" }] },
      imePreedit: { range: { from: 6, to: 6 }, text: "ab" }
    });
    const mapping = frame.canonicalPositionMapping!;
    expect(frame.layoutSnapshot.state.doc.textBetween(mapping.map(8), mapping.map(8) + 5)).toBe("world");
  });
});
