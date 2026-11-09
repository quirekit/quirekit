// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { Compartment, EditorSelection, EditorState } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { markdown } from "@quirekit/cm-lang-markdown";
import { sourceRevealSetting } from "@quirekit/msfe-core";
import { modeFacet } from "@quirekit/msfe-core/state";
import { Math as MathExtension } from "@quirekit/msfe-markdown-extras";
import { collapseBlankLine, proseSpacing } from "./spacing";

/** @param doc - Source fixture. @param anchor - Insertion position. @param reveal - Source visibility preference. @returns Source-owned document presentation. */
function fixture(doc: string, anchor: number, reveal: "hidden" | "selection" = "hidden"): EditorState {
  return EditorState.create({ doc, selection: { anchor }, extensions: [markdown(), modeFacet.of("live"), sourceRevealSetting.extension(() => reveal), proseSpacing] });
}

let view: EditorView | undefined;
afterEach(() => { view?.destroy(); view = undefined; });

describe("editable paragraph spacing", () => {
  it.each(["", "text\n", "> quote\n> ", "text\n\n\n\n"])("retains a caret line at EOF: %s", doc => {
    const state = fixture(doc, doc.length);
    expect(collapseBlankLine(state, state.doc.lineAt(doc.length))).toBe(false);
  });

  it("collapses the separators around the authored empty paragraph of a blank run", () => {
    const state = fixture("before\n\n\n\nafter", 0);
    expect([2, 3, 4].map(number => collapseBlankLine(state, state.doc.line(number)))).toEqual([true, false, true]);
    const selected = state.update({ selection: { anchor: state.doc.line(2).from } }).state;
    expect(collapseBlankLine(selected, selected.doc.line(2))).toBe(true);
  });

  it.each([["text  \n\n\nafter", 2], ["- item  \n  \n\nafter", 2]])("keeps the row a hard break opened and collapses the separator below: %s", (doc, number) => {
    const state = fixture(doc, 0);
    expect([number, number + 1].map(line => collapseBlankLine(state, state.doc.line(line)))).toEqual([false, true]);
  });

  it("still collapses the separator after a trailing hard break that ends a paragraph", () => {
    const state = fixture("text  \n\nafter", 0);
    expect(collapseBlankLine(state, state.doc.line(2))).toBe(true);
  });

  it("preserves blank code-body lines independently of selection", () => {
    const state = fixture("```text\n\ncode\n\n```", 0);
    expect(collapseBlankLine(state, state.doc.line(2))).toBe(false);
    expect(collapseBlankLine(state, state.doc.line(4))).toBe(false);
  });

  it.each([
    ["> quote\n> \n\nafter", 2],
    ["> quote\n>   \n\n## after", 2],
    ["> outer\n> > inner\n> > \n> after", 3],
    ["- > quote\n  > \n\nafter", 2],
  ])("retains the trailing editable line of its semantic flow: %s", (doc, number) => {
    const original = fixture(doc, 0), line = original.doc.line(number);
    for (const state of [original, original.update({ selection: { anchor: line.to } }).state, fixture(doc, line.to, "selection")]) {
      expect(collapseBlankLine(state, state.doc.line(number))).toBe(false);
    }
  });

  it("does not treat a plugin's literal body as paragraph separation", () => {
    const syntax = MathExtension.resolve(() => { throw new Error("No editor in grammar fixtures"); }).syntax!;
    const state = EditorState.create({ doc: "$$\na\n\nb\n$$", selection: { anchor: 5 },
      extensions: [markdown({ extensions: syntax }), modeFacet.of("live")] });
    expect(collapseBlankLine(state, state.doc.line(3))).toBe(false);
  });

  it.each(["before\n  \nafter", "> before\n> \n> after", "before\n\nafter"])("keeps separator height independent of selection and reveal preference: %s", doc => {
    const original = fixture(doc, 0), position = original.doc.line(2).from;
    const selected = original.update({ selection: { anchor: position } }).state;
    const revealed = fixture(doc, position, "selection");
    for (const state of [original, selected, revealed]) expect(collapseBlankLine(state, state.doc.line(2))).toBe(true);
  });

  it("reuses decoration and navigation identity during caret motion", () => {
    view = new EditorView({ state: fixture("before\n\nafter", 1), parent: document.body });
    const initial = view.plugin(proseSpacing)!.decorations, atomic = view.plugin(proseSpacing)!.atomic;
    view.dispatch({ selection: { anchor: 4 } });
    expect(view.plugin(proseSpacing)!.decorations).toBe(initial);
    view.dispatch({ selection: { anchor: 7 } });
    expect(view.state.selection.main.head).toBe(8);
    expect(view.plugin(proseSpacing)!.decorations.size).toBe(1);
    view.dispatch({ selection: { anchor: 10 } });
    expect(view.plugin(proseSpacing)!.decorations.size).toBe(1);
    expect(view.plugin(proseSpacing)!.decorations).toBe(initial);
    expect(view.plugin(proseSpacing)!.atomic).toBe(atomic);
  });

  it("normalizes each directed separator endpoint without changing source or collapsing ranges", () => {
    const original = fixture("before\n\nafter", 10);
    expect(original.update({ selection: { anchor: 7 } }).state.selection.main.head).toBe(6);
    const forward = original.update({ selection: EditorSelection.single(3, 7) }).state;
    const backward = original.update({ selection: EditorSelection.single(10, 7) }).state;
    expect(forward.selection.main.toJSON()).toEqual({ anchor: 3, head: 8 });
    expect(backward.selection.main.toJSON()).toEqual({ anchor: 10, head: 6 });
    expect(forward.doc).toBe(original.doc); expect(backward.doc).toBe(original.doc);
  });

  it("keeps source separators editable and reclassifies a typed row before returning to prose", () => {
    const mode = new Compartment();
    const original = EditorState.create({ doc: "before\n\nafter", selection: { anchor: 7 },
      extensions: [markdown(), mode.of(modeFacet.of("source")), proseSpacing] });
    expect(original.update({ selection: { anchor: 7 } }).state.selection.main.head).toBe(7);
    expect(original.update({ effects: mode.reconfigure(modeFacet.of("live")) }).state.selection.main.head).toBe(8);
    const typed = original.update({ changes: { from: 7, insert: "Typed" }, selection: { anchor: 12 } }).state;
    const document = typed.update({ effects: mode.reconfigure(modeFacet.of("live")) }).state;
    expect(document.selection.main.head).toBe(12);
    expect(collapseBlankLine(document, document.doc.line(2))).toBe(false);
    expect(document.doc.toString()).toBe("before\nTyped\nafter");
  });

});
