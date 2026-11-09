import { describe, expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { accidentalCode, preservedBlocks } from "./invariants";

/** @param before - Source. @param from - Edit start. @param to - Edit end. @param insert - Replacement. @returns Both states and the edit. */
function edit(before: string, from: number, to: number, insert: string) {
  const state = EditorState.create({ doc: before, extensions: markdown({ extensions: GFM }) });
  const transaction = state.update({ changes: { from, to, insert } });
  return [state, transaction.state, transaction.changes] as const;
}

describe("input quality invariants", () => {
  it("reports an untouched item whose nesting changed (I1)", () => {
    const [before, after, changes] = edit("- 一\n- \n- 三", 6, 7, "");
    expect(preservedBlocks(before, after, changes).map(item => item.rule)).toContain("I1");
  });

  it("reports an untouched block absorbed into a paragraph (I1)", () => {
    const [before, after, changes] = edit("前文\n\n1. 一\n2. 二", 2, 7, "");
    expect(preservedBlocks(before, after, changes).length).toBeGreaterThan(0);
  });

  it("accepts an edit inside one paragraph", () => {
    const [before, after, changes] = edit("甲乙\n\n- 一", 1, 1, "字");
    expect(preservedBlocks(before, after, changes)).toEqual([]);
  });

  it("reports an indented code block created by an edit (I2)", () => {
    const [before, after, changes] = edit("甲\n\n- 一\n    - 子", 3, 7, "");
    expect(accidentalCode(before, after, changes).map(item => item.rule)).toEqual(["I2"]);
  });
});
