import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { changeListIndent, continueList } from "./commands";

/** @param doc - Markdown source. @param text - Caret landmark. @returns Canonical state with installed Markdown. */
function state(doc: string, text: string): EditorState {
  return EditorState.create({ doc, selection: { anchor: doc.indexOf(text) + text.length }, extensions: markdown({ extensions: GFM }) });
}
describe("list structural commands", () => {
  it("moves a whole item including descendants and preserves task state", () => {
    const doc = "- first\n- [x] second\n  - child\n- last";
    const before = state(doc, "second");
    const nested = before.update(changeListIndent(1)(before)!).state;
    expect(nested.doc.toString()).toBe("- first\n  - [x] second\n    - child\n- last");
    expect(nested.update(changeListIndent(-1)(nested)!).state.doc.toString()).toBe(doc);
  });
  it("uses the previous ordered marker width and preserves a backward multi-item selection", () => {
    const doc = "> 10. first\n> 11. second\n> 12. third";
    let before = state(doc, "second");
    before = before.update({ selection: EditorSelection.range(doc.length, doc.indexOf("second")) }).state;
    const spec = changeListIndent(1)(before)!;
    expect(spec).not.toBeNull();
    const after = before.update(spec).state;
    expect(after.doc.toString()).toBe("> 10. first\n>     1. second\n>     2. third");
    expect(after.selection.main.anchor).toBeGreaterThan(after.selection.main.head);
  });
  it("refuses first-item indentation and can unwrap a root task without losing its body", () => {
    expect(changeListIndent(1)(state("- first", "first"))).toBeNull();
    const before = state("- [x] done", "done");
    expect(before.update(changeListIndent(-1)(before)!).state.doc.toString()).toBe("done");
  });
  it("continues task items with unchecked markers and exposes CM empty-item exit", () => {
    const before = state("- [x] done", "done");
    const after = before.update(continueList()(before)!).state;
    expect(after.doc.toString()).toBe("- [x] done\n- [ ] ");
    const empty = state("- ", "- ");
    expect(empty.update(continueList()(empty)!).state.doc.toString()).toBe("");
    expect(continueList()(state("ordinary", "ordinary"))).toBeNull();
  });
  it("keeps enclosing quotes when unwrapping and refuses shared opening lines", () => {
    const source = "- outer\n  > - child\n  >   continuation";
    const before = state(source, "child");
    expect(before.update(changeListIndent(-1)(before)!).state.doc.toString()).toBe("- outer\n  > child\n  > continuation");
    expect(changeListIndent(-1)(state("- - shared", "shared"))).toBeNull();
    const empty = state("-", "-");
    expect(empty.update(changeListIndent(-1)(empty)!).state.doc.toString()).toBe("");
  });
  it("targets the nested item when the caret sits at its line end", () => {
    const before = state("1. top\n   - first\n   - second", "first");
    expect(before.update(changeListIndent(-1)(before)!).state.doc.toString()).toBe("1. top\n- first\n   - second");
  });
  it("separates unwrapped root items from neighboring items with blank lines", () => {
    const middle = state("- a\n- b\n- c", "b");
    expect(middle.update(changeListIndent(-1)(middle)!).state.doc.toString()).toBe("- a\n\nb\n\n- c");
    let pair = state("1. a\n2. b\n3. c\n4. d", "b");
    pair = pair.update({ selection: EditorSelection.range(pair.doc.toString().indexOf("b"), pair.doc.toString().indexOf("c") + 1) }).state;
    expect(pair.update(changeListIndent(-1)(pair)!).state.doc.toString()).toBe("1. a\n\nb\n\nc\n\n2. d");
    const quoted = state("> - a\n> - b", "b");
    expect(quoted.update(changeListIndent(-1)(quoted)!).state.doc.toString()).toBe("> - a\n>\n> b");
    const loose = state("- a\n\n- b\n\n- c", "b");
    expect(loose.update(changeListIndent(-1)(loose)!).state.doc.toString()).toBe("- a\n\nb\n\n- c");
  });
  it("keeps ordered numbers consecutive when nesting into a new or existing list", () => {
    const fresh = state("1. a\n2. b\n3. c", "b");
    expect(fresh.update(changeListIndent(1)(fresh)!).state.doc.toString()).toBe("1. a\n   1. b\n2. c");
    const paren = state("9) a\n10) b", "b");
    expect(paren.update(changeListIndent(1)(paren)!).state.doc.toString()).toBe("9) a\n   1) b");
    const join = state("1. a\n   1. x\n2. b", "b");
    expect(join.update(changeListIndent(1)(join)!).state.doc.toString()).toBe("1. a\n   1. x\n   2. b");
    const nested = fresh.update(changeListIndent(1)(fresh)!).state;
    const lifted = state(nested.doc.toString(), "b");
    expect(lifted.update(changeListIndent(-1)(lifted)!).state.doc.toString()).toBe("1. a\n2. b\n3. c");
  });
  it("continues the outer numbers and restarts the siblings left under a lifted item", () => {
    const before = state("1. top\n   1. a\n   2. b\n   3. c", "a");
    expect(before.update(changeListIndent(-1)(before)!).state.doc.toString()).toBe("1. top\n2. a\n   1. b\n   2. c");
  });
  it("leaves code inside a list item to the code block", () => {
    const doc = "- one\n- two\n\n  ```ts\n  code\n  ```";
    expect(changeListIndent(1)(state(doc, "code"))).toBeNull();
    expect(changeListIndent(-1)(state(doc, "code"))).toBeNull();
    expect(continueList()(state(doc, "code"))).toBeNull();
  });
});
