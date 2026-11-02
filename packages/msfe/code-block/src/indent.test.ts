import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, Prec, type EditorState as State } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { createMsfeReadState } from "@quirekit/msfe-core";
import { CodeBlock } from "./code-block";
import { indentCode } from "./indent";

/** @param markdown - Source with `|` marking the caret or `[`/`]` marking a selection. @returns Parsed editable state. */
function fixture(markdown: string): State {
  const caret = markdown.indexOf("|"), from = markdown.indexOf("["), to = markdown.indexOf("]");
  const doc = markdown.replace(/[|[\]]/gu, "");
  const selection = caret >= 0 ? EditorSelection.cursor(caret) : EditorSelection.range(from, to - 1);
  const state = createMsfeReadState({ markdown: doc, extensions: [CodeBlock,
    { id: "editable-test", extensions: Prec.highest(EditorState.readOnly.of(false)) }] }).update({ selection }).state;
  expect(ensureSyntaxTree(state, state.doc.length, 5000)).not.toBeNull(); return state;
}

/** @param state - Input state. @param direction - Indent or outdent. @returns Resulting source with `|` at the main caret, or null when refused. */
function run(state: State, direction: 1 | -1): string | null {
  const spec = indentCode(direction)(state);
  if (!spec) return null;
  const next = state.update(spec).state, head = next.selection.main.head;
  return next.selection.main.empty ? next.sliceDoc(0, head) + "|" + next.sliceDoc(head) : next.doc.toString();
}

describe("code block indentation", () => {
  it("inserts spaces to the next indent stop at an empty caret", () => {
    expect(run(fixture("```ts\nconst obj = {\n|\n}\n```"), 1)).toBe("```ts\nconst obj = {\n  |\n}\n```");
    expect(run(fixture("```ts\na|b\n```"), 1)).toBe("```ts\na |b\n```");
  });

  it("indents and outdents every selected code line once", () => {
    const state = fixture("```ts\n[const obj = {\n\n}]\n```");
    expect(run(state, 1)).toBe("```ts\n  const obj = {\n\n  }\n```");
    expect(run(fixture("```ts\n[  a\n    b]\n```"), -1)).toBe("```ts\na\n  b\n```");
  });

  it("outdents the caret line without selecting it", () => {
    expect(run(fixture("```ts\n    re|turn\n```"), -1)).toBe("```ts\n  re|turn\n```");
  });

  it("keeps quote and list prefixes outside the inserted indentation", () => {
    expect(run(fixture("> ```ts\n> [a\n> b]\n> ```"), 1)).toBe("> ```ts\n>   a\n>   b\n> ```");
    expect(run(fixture("- item\n\n  ```ts\n  [a]\n  ```"), 1)).toBe("- item\n\n  ```ts\n    a\n  ```");
  });

  it("refuses positions outside the code body", () => {
    expect(run(fixture("para|graph\n\n```ts\na\n```"), 1)).toBeNull();
    expect(run(fixture("```t|s\na\n```"), 1)).toBeNull();
    expect(run(fixture("[text\n\n```ts\na]\n```"), 1)).toBeNull();
  });
});
