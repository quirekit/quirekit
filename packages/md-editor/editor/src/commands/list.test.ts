import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { toggleMdList } from "./list";

/** @param source - Source with one ¦ caret or ⟦…⟧ selection. @param kind - Requested list kind. @returns Source after the toggle. */
function toggle(source: string, kind: "bullet" | "ordered" | "task"): string | null {
  const from = source.includes("⟦") ? source.indexOf("⟦") : source.indexOf("¦"), to = source.includes("⟧") ? source.indexOf("⟧") - 1 : from;
  const state = EditorState.create({ doc: source.replace(/[¦⟦⟧]/gu, ""), selection: EditorSelection.single(from, to), extensions: markdown({ extensions: GFM }) });
  ensureSyntaxTree(state, state.doc.length, 5000);
  const spec = toggleMdList(kind)(state);
  return spec ? state.update(spec).state.doc.toString() : null;
}

describe("list kind toggles", () => {
  it.each([
    ["- 甲\n- 乙¦\n- 丙", "ordered", "1. 甲\n2. 乙\n3. 丙"],
    ["1. 甲\n2. 乙¦", "bullet", "- 甲\n- 乙"],
    ["- 甲¦\n- 乙", "task", "- [ ] 甲\n- [ ] 乙"],
    ["- 甲\n  - 子一¦\n  - 子二\n- 乙", "ordered", "- 甲\n  1. 子一\n  2. 子二\n- 乙"],
    ["- 甲\n- ⟦乙⟧\n- 丙", "ordered", "- 甲\n1. 乙\n- 丙"],
    ["- 甲\n- 乙¦\n- 丙", "bullet", "- 甲\n\n乙\n\n- 丙"],
    ["甲¦", "ordered", "1. 甲"],
  ] as const)("%s → %s", (source, kind, expected) => expect(toggle(source, kind)).toBe(expected));
});
