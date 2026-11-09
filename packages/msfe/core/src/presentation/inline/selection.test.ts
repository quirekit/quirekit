import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, Prec, type Extension } from "@quirekit/cm-state";
import { LanguageDescription, LanguageSupport } from "@quirekit/cm-language";
import { commonmarkLanguage } from "@quirekit/cm-lang-markdown";
import { createMarkdownLanguage } from "../../markdown/parsing/language";
import { compositionEffect, compositionField, modeFacet } from "../../state/fields";
import { revealSelectionEffect, revealSelectionField } from "../gesture";
import { sourceRevealSetting } from "../visibility";
import { inlineBoundaryNavigation } from "./navigation";
import type { InlineBoundaryRule } from "./types";

const rules: readonly InlineBoundaryRule[] = [
  { nodes: ["InlineCode"], marker: "CodeMark", behavior: "split" },
  { nodes: ["StrongEmphasis", "Emphasis"], marker: "EmphasisMark", behavior: "content" },
];

/** @param doc - Markdown fixture. @param extra - Optional overrides. @returns Canonical parser with shared navigation. */
function stateFor(doc: string, extra: Extension = []) {
  return EditorState.create({ doc, extensions: [createMarkdownLanguage([]), EditorState.allowMultipleSelections.of(true), modeFacet.of("live"), compositionField, revealSelectionField,
    sourceRevealSetting.extension(() => "hidden"), inlineBoundaryNavigation(rules), extra] });
}

describe("configurable inline boundary selection", () => {
  it("retains code insertion offsets and associates each edge with its actual side", () => {
    const state = stateFor("L ``code`` R");
    for (const [position, assoc] of [[2, -1], [4, 1], [8, -1], [10, 1]]) {
      const next = state.update({ selection: { anchor: position! } }).state;
      expect(next.selection.main.head).toBe(position); expect(next.selection.main.assoc).toBe(assoc);
      expect(next.doc).toBe(state.doc);
    }
  });

  it("enters nested formatting without changing text or directed ranges", () => {
    const state = stateFor("L ***word*** R");
    expect(state.update({ selection: { anchor: 2 } }).state.selection.main.head).toBe(5);
    expect(state.update({ selection: { anchor: 12 } }).state.selection.main.head).toBe(9);
    const selection = EditorSelection.create([EditorSelection.range(13, 1), EditorSelection.cursor(0)], 0);
    expect(state.update({ selection }).state.selection.eq(selection)).toBe(true);
  });

  it("stops after a style that closes its line when the caret moves or is placed there", () => {
    const state = stateFor("L **word**\nnext"), select = (from: number, to: number) =>
      state.update({ selection: { anchor: from } }).state.update({ selection: { anchor: to }, userEvent: "select" }).state.selection.main.head;
    expect(select(2, 10)).toBe(10);
    expect(select(7, 8)).toBe(10);
    expect(state.update({ selection: { anchor: 10 } }).state.update({ selection: { anchor: 9 }, userEvent: "select" }).state.selection.main.head).toBe(8);
    // Typing at the content end stays inside; mid-line styles keep a single inside stop.
    const typed = state.update({ selection: { anchor: 8 } }).state.update({ changes: { from: 8, insert: "s" }, selection: { anchor: 9 }, userEvent: "input.type" }).state;
    expect([typed.doc.toString(), typed.selection.main.head]).toEqual(["L **words**\nnext", 9]);
    // Nested styles share the stop at the line end, after every closer.
    const nested = stateFor("L ***word***\nnext"), nestedSelect = (from: number, to: number) =>
      nested.update({ selection: { anchor: from } }).state.update({ selection: { anchor: to }, userEvent: "select" }).state.selection.main.head;
    expect([nestedSelect(6, 9), nestedSelect(6, 10), nestedSelect(2, 12), nestedSelect(12, 11)]).toEqual([12, 12, 12, 9]);
    // A click reports the label end while the pointer is down and settles at the line end on release.
    const pressed = nested.update({ selection: { anchor: 9 }, effects: revealSelectionEffect.of(EditorSelection.single(9)), userEvent: "select.pointer" }).state;
    expect(pressed.selection.main.head).toBe(9);
    expect(pressed.update({ effects: revealSelectionEffect.of(null) }).state.selection.main.head).toBe(12);
    const middle = stateFor("L **word** R");
    expect(middle.update({ selection: { anchor: 2 } }).state.update({ selection: { anchor: 10 }, userEvent: "select" }).state.selection.main.head).toBe(8);
  });

  it("accepts custom policies and explicit native opt-out by precedence", () => {
    const state = stateFor("L `code` R", Prec.high(inlineBoundaryNavigation([{ nodes: ["InlineCode"], marker: "CodeMark", behavior: "content" }])));
    expect(state.update({ selection: { anchor: 2 } }).state.selection.main.head).toBe(3);
    const native = stateFor("L *word* R", Prec.high(inlineBoundaryNavigation([{ nodes: ["Emphasis"], marker: "EmphasisMark", behavior: "native" }])));
    expect(native.update({ selection: { anchor: 2 } }).state.selection.main.head).toBe(2);
  });

  it("preserves source mode, revealed syntax, composition and held pointer ownership", () => {
    const source = stateFor("L *word* R", Prec.high(modeFacet.of("source")));
    expect(source.update({ selection: { anchor: 2 } }).state.selection.main.head).toBe(2);
    const revealed = stateFor("L *word* R", Prec.high(sourceRevealSetting.extension(() => "selection")));
    expect(revealed.update({ selection: { anchor: 2 } }).state.selection.main.head).toBe(2);
    for (const effects of [compositionEffect.of(true), revealSelectionEffect.of(EditorSelection.single(0))]) {
      const active = stateFor("L *word* R").update({ effects }).state;
      expect(active.update({ selection: { anchor: 2 } }).state.selection.main.head).toBe(2);
    }
  });

  it("leaves literal formatting inside a Markdown code-language overlay untouched", () => {
    const code = LanguageDescription.of({ name: "markdown", support: new LanguageSupport(commonmarkLanguage) });
    const source = "```markdown\n*word*\n```";
    const state = stateFor(source, Prec.high(createMarkdownLanguage([], () => code)));
    const start = source.indexOf("*word*");
    for (const position of [start, start + 1, start + 5, start + 6]) {
      expect(state.update({ selection: { anchor: position } }).state.selection.main.head).toBe(position);
    }
  });
});
