import { describe, expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { modeFacet } from "@quirekit/msfe-core/state";
import { proseStructureField } from "./structure";
import { insertMarkdownBlock } from "../commands/insert";

describe("Prose source block adapter", () => {
  it("retains one structural index across selection-only transactions", () => {
    const initial = EditorState.create({ doc: "# Title\n\n- Outer\n  - Inner\n\n> A quote\n", extensions: [markdown(), modeFacet.of("live"), proseStructureField] });
    // This headless identity assertion needs an accepted complete parse. Under
    // build contention CM may spend its initial budget on only the first block.
    expect(ensureSyntaxTree(initial, initial.doc.length, 1000)).not.toBeNull();
    const state = initial.update({}).state;
    const wrappers = state.field(proseStructureField);
    const first = state.update({ selection: { anchor: 3 } }).state;
    const second = first.update({ selection: { anchor: 15, head: 22 } }).state;
    expect(first.field(proseStructureField)).toBe(wrappers);
    expect(second.field(proseStructureField)).toBe(wrappers);
    const intervals: [number, number][] = [];
    for (let cursor = wrappers.iter(); cursor.value; cursor.next()) intervals.push([cursor.from, cursor.to]);
    expect(intervals).toContainEqual([0, 7]);
    expect(intervals.length).toBeGreaterThan(6);
    expect(first.update({ changes: { from: 2, to: 7, insert: "Renamed" } }).state.field(proseStructureField)).not.toBe(wrappers);
  });

  it("keeps unknown syntax as ordinary paragraphs and source mode unwrapped", () => {
    const doc = "::: unknown Title\nbody\n:::";
    for (const mode of ["source", "live"] as const) {
      const state = EditorState.create({ doc, extensions: [markdown(), modeFacet.of(mode), proseStructureField] });
      expect(state.doc.toString()).toBe(doc);
      expect(state.field(proseStructureField).size).toBe(mode === "source" ? 0 : 1);
    }
  });

  it("keeps a list or heading marker without its space as literal text until the space is typed", () => {
    /** @param doc - Source. @returns Wrapper tag names. */
    const tags = (doc: string) => {
      const state = EditorState.create({ doc, extensions: [markdown(), modeFacet.of("live"), proseStructureField] });
      ensureSyntaxTree(state, state.doc.length, 1000);
      const names: string[] = [];
      for (let cursor = state.update({}).state.field(proseStructureField).iter(); cursor.value; cursor.next()) names.push(cursor.value.tagName);
      return names.sort();
    };
    expect(tags("-")).toEqual([]);
    expect(tags("1.")).toEqual([]);
    expect(tags("##")).toEqual([]);
    expect(tags("## a")).toEqual(["div"]);
    expect(tags("- ")).toEqual(["li", "ul"]);
    expect(tags("- a\n-")).toEqual(["div", "li", "ul"]);
  });

  it("inserts one canonical block without replacing the surrounding document", () => {
    const state = EditorState.create({ doc: "before\nafter", selection: { anchor: 6 }, extensions: [markdown()] });
    const transaction = insertMarkdownBlock("::: note Title\nbody\n:::")(state);
    expect(transaction).not.toBeNull();
    const next = state.update(transaction!).state;
    expect(next.doc.toString()).toBe("before\n\n::: note Title\nbody\n:::\n\nafter");
  });
});
