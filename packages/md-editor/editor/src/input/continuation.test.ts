import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, StateEffect } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { compositionEffect, compositionField, modeFacet } from "@quirekit/msfe-core/state";
import { continueDocumentMarkup } from "./continuation";
import { exitEmptyQuote } from "./quote";

describe("document list continuation", () => {
  it.each([
    ["- item\n- ¦", "- item\n\n¦"],
    ["- [x] item\n- [ ] ¦", "- [x] item\n\n¦"],
    ["1. item\n2. ¦", "1. item\n\n¦"],
    ["> - item\n> - ¦", "> - item\n> \n> ¦"],
    ["- parent\n  - child\n  - ¦", "- parent\n  - child\n- ¦"],
    ["- item¦", "- item\n- ¦"],
    ["- [x] item¦", "- [x] item\n- [ ] ¦"],
  ])("continues or exits one list level without a phantom loose item: %s", (source, expected) => {
    const state = EditorState.create({ doc: source.replace("¦", ""), selection: { anchor: source.indexOf("¦") },
      extensions: [markdown({ extensions: GFM }), modeFacet.of("live")] });
    const spec = continueDocumentMarkup(state);
    expect(spec).not.toBeNull();
    const next = state.update(spec!).state;
    expect(next.doc.toString()).toBe(expected.replace("¦", ""));
    expect(next.selection.main.head).toBe(expected.indexOf("¦"));
  });
});

describe("document quote continuation", () => {
  it.each([
    ["> text\n> ¦", "> text\n\n¦"],
    ["> text\n>¦", "> text\n\n¦"],
    ["> text\n> ¦\n\nnext", "> text\n\n¦\n\nnext"],
    ["> text\n>   ¦\n\nnext", "> text\n\n¦\n\nnext"],
    ["> text\n> ¦\n> rest", "> text\n\n¦\n> rest"],
    ["> outer\n> > inner\n> > ¦", "> outer\n> > inner\n> \n> ¦"],
    ["> outer\n> > inner\n> > ¦\n> \n> next", "> outer\n> > inner\n> \n> ¦\n> \n> next"],
    ["- > inner\n  > ¦", "- > inner\n  \n  ¦"],
    ["> - > inner\n>   > ¦", "> - > inner\n>   \n>   ¦"],
    ["- > ¦", "- ¦"],
    ["> ¦", "¦"],
    ["> first\n> \n> ¦", "> first\n\n¦"],
    ["> text¦", "> text\n>\n> ¦"],
    ["> 甲¦乙", "> 甲\n>\n> ¦乙"],
    ["> > 内¦", "> > 内\n> >\n> > ¦"],
    ["> text\n>\n> ¦", "> text\n\n¦"],
    ["> outer\n> > inner\n> >\n> > ¦", "> outer\n> > inner\n> \n> ¦"],
  ])("continues text or exits exactly one empty quote level: %s", (source, expected) => {
    const state = EditorState.create({ doc: source.replace("¦", ""), selection: { anchor: source.indexOf("¦") },
      extensions: [markdown({ extensions: GFM }), modeFacet.of("live")] });
    const spec = continueDocumentMarkup(state);
    expect(spec).not.toBeNull();
    const next = state.update(spec!).state;
    expect(next.doc.toString()).toBe(expected.replace("¦", ""));
    expect(next.selection.main.head).toBe(expected.indexOf("¦"));
  });

  it("leaves source, locked, readonly and composition input to their existing owners", () => {
    const doc = "> text\n> ";
    const state = EditorState.create({ doc, selection: { anchor: doc.length },
      extensions: [markdown(), modeFacet.of("live"), compositionField] });
    const guarded = [
      state.update({ effects: StateEffect.appendConfig.of(EditorState.readOnly.of(true)) }).state,
      state.update({ effects: compositionEffect.of(true) }).state,
      ...(["source", "locked"] as const).map(mode => EditorState.create({ doc, selection: { anchor: doc.length },
        extensions: [markdown(), modeFacet.of(mode)] })),
    ];
    for (const guardedState of guarded) expect(continueDocumentMarkup(guardedState)).toBeNull();
  });

  it.each(["```text\n> ¦\n```", "> ```text\n> ¦\n> ```", "    > ¦", "> text¦"])(
    "does not interpret literal or nonempty quote content as an exit: %s", source => {
      const state = EditorState.create({ doc: source.replace("¦", ""), selection: { anchor: source.indexOf("¦") },
        extensions: [markdown(), modeFacet.of("live")] });
      expect(exitEmptyQuote(state)).toBeNull();
    },
  );

  it("maps compatible carets in one transaction without a partial exit for mixed selections", () => {
    const source = "> first\n> ¦\n\nnext\n\n> second\n> ¦";
    const expected = "> first\n\n¦\n\nnext\n\n> second\n\n¦";
    const positions = [...source.matchAll(/¦/gu)].map((match, index) => match.index - index);
    const state = EditorState.create({ doc: source.replaceAll("¦", ""),
      selection: EditorSelection.create(positions.map(pos => EditorSelection.cursor(pos))),
      extensions: [EditorState.allowMultipleSelections.of(true), markdown(), modeFacet.of("live")] });
    const next = state.update(continueDocumentMarkup(state)!).state;
    expect(next.doc.toString()).toBe(expected.replaceAll("¦", ""));
    expect(next.selection.ranges.map(range => range.head)).toEqual([...expected.matchAll(/¦/gu)].map((match, index) => match.index - index));
    const mixed = state.update({ selection: EditorSelection.create([
      EditorSelection.cursor(positions[0]!), EditorSelection.range(positions[1]! - 2, positions[1]!),
    ]) }).state;
    expect(exitEmptyQuote(mixed)).toBeNull();
  });
});
