import { describe, expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { insertMdDate, insertMdMention, insertMdText } from "./portable";

describe("portable inline insertions", () => {
  it("stores a timezone-free real date and refuses invalid calendar days", () => {
    const state = EditorState.create({ doc: "Review: soon", selection: { anchor: 8, head: 12 } });
    expect(state.update(insertMdDate("2028-02-29")(state)!).state.doc.toString()).toBe("Review: 2028-02-29");
    expect(insertMdDate("2026-02-29")(state)).toBeNull();
    expect(insertMdDate("2026-13-01")(state)).toBeNull();
    expect(insertMdDate("2026-10-09T00:00Z")(state)).toBeNull();
  });
  it("replaces only the trigger with an escaped safe Markdown link", () => {
    const state = EditorState.create({ doc: "Hi @!", selection: { anchor: 3, head: 4 } });
    const next = state.update(insertMdMention({ id: "1", label: "[Lin]", url: "/people/1" })(state)!).state;
    expect(next.doc.toString()).toBe("Hi [@\\[Lin\\]](/people/1)!");
    expect(insertMdMention({ id: "1", label: "Lin", url: "javascript:alert(1)" })(state)).toBeNull();
  });
  it("preserves a composed emoji sequence and places the caret after it", () => {
    const state = EditorState.create({ doc: "Good ", selection: { anchor: 5 } });
    const next = state.update(insertMdText("🧑‍💻")(state)!).state;
    expect(next.doc.toString()).toBe("Good 🧑‍💻");
    expect(next.selection.main.head).toBe(next.doc.length);
  });
});
