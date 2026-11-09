import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, Prec, type EditorState as State } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { createMsfeReadState } from "@quirekit/msfe-core";
import { CodeBlock } from "./code-block";
import { toggleCodeBlock } from "./toggle";

/** @param markdown - Source with `|` marking the caret or `[`/`]` marking a selection. @returns Parsed editable state. */
function fixture(markdown: string): State {
  const caret = markdown.indexOf("|"), from = markdown.indexOf("["), to = markdown.indexOf("]");
  const doc = markdown.replace(/[|[\]]/gu, "");
  const selection = caret >= 0 ? EditorSelection.cursor(caret) : EditorSelection.range(from, to - 1);
  const state = createMsfeReadState({ markdown: doc, extensions: [CodeBlock,
    { id: "editable-test", extensions: Prec.highest(EditorState.readOnly.of(false)) }] }).update({ selection }).state;
  expect(ensureSyntaxTree(state, state.doc.length, 5000)).not.toBeNull(); return state;
}

/** @param markdown - Fixture source. @returns Resulting source with `|` at the main caret, or null when refused. */
function toggle(markdown: string): string | null {
  const state = fixture(markdown), spec = toggleCodeBlock()(state);
  if (!spec) return null;
  const next = state.update(spec).state, head = next.selection.main.head;
  return next.selection.main.empty ? next.sliceDoc(0, head) + "|" + next.sliceDoc(head) : next.doc.toString();
}

describe("code block toggle", () => {
  it("opens an empty block on an empty line with both fences, above an existing block", () => {
    expect(toggle("text\n\n|\n\n```\ncode\n```")).toBe("text\n\n```\n|\n```\n\n```\ncode\n```");
    expect(toggle("> |")).toBe("> ```\n> |\n> ```");
    expect(toggle("- |")).toBe("- ```\n  |\n  ```");
  });

  it("wraps the caret line or the selected lines", () => {
    expect(toggle("a\nco|de\nb")).toBe("a\n```\nco|de\n```\nb");
    expect(toggle("[one\ntwo]\n\nafter")).toBe("```\none\ntwo\n```\n\nafter");
    expect(toggle("- it|em")).toBe("- ```\n  it|em\n  ```");
    expect(toggle("> quo|te")).toBe("> ```\n> quo|te\n> ```");
  });

  it("uses a fence longer than any backtick run in the wrapped text", () => {
    expect(toggle("type |``` to open")).toBe("````\ntype |``` to open\n````");
  });

  it("turns a fenced block back into text", () => {
    expect(toggle("```js\nco|de\n```\nafter")).toBe("co|de\nafter");
    expect(toggle("> ```\n> a|\n> b\n> ```")).toBe("> a|\n> b");
    expect(toggle("- ```\n  it|em\n  ```")).toBe("- it|em");
    expect(toggle("```|\n```")).toBe("|");
    expect(toggle("```\nopen|")).toBe("open|");
  });
});
