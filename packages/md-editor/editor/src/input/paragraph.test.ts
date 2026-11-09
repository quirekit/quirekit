import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, StateEffect } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { GFM } from "@quirekit/lezer-markdown";
import { sourceRevealSetting } from "@quirekit/msfe-core";
import { compositionEffect, compositionField, modeFacet } from "@quirekit/msfe-core/state";
import { CustomContainer, Frontmatter } from "@quirekit/msfe-markdown-extras";
import { exitDocumentBlock, insertDocumentLineBreak, insertDocumentParagraph, openBlankRow } from "./paragraph";

const containerSyntax = CustomContainer.resolve(() => { throw new Error("Grammar fixtures do not mount an editor"); }).syntax!;
const frontmatterSyntax = Frontmatter.resolve(() => { throw new Error("Grammar fixtures do not mount an editor"); }).syntax!;

/** @param state - Headless grammar fixture. @returns Accepted parse, independent of the parser's initial wall-time budget under parallel tests. */
function parsed(state: EditorState): EditorState {
  expect(ensureSyntaxTree(state, state.doc.length, 5000)).not.toBeNull();
  return state.update({}).state;
}

/** @param doc - Fixture with one caret marker. @returns Document editing state with actual Markdown syntax. */
function fixture(doc: string): EditorState {
  const anchor = doc.indexOf("¦");
  return parsed(EditorState.create({ doc: doc.replace("¦", ""), selection: { anchor }, extensions: [
    markdown({ extensions: [GFM, containerSyntax, frontmatterSyntax] }), modeFacet.of("live"), compositionField,
    sourceRevealSetting.extension(() => "hidden"),
  ] }));
}

describe("document paragraph input", () => {
  it.each([
    ["Text¦", "Text\n\n¦"],
    ["## Heading¦", "## Heading\n\n¦"],
    ["Heading¦\n===", "Heading\n===\n\n¦"],
    ["Text **bold**¦\n\nNext", "Text **bold**\n\n¦\n\nNext"],
    ["::: note Title\nText¦\n:::", "::: note Title\nText\n\n¦\n:::"],
    ["```text\ncode\n```¦", "```text\ncode\n```\n\n¦"],
    ["::: note Title\nText\n:::¦", "::: note Title\nText\n:::\n\n¦"],
    ["***¦", "***\n\n¦"],
    ["---\ntitle: Test\n---¦", "---\ntitle: Test\n---\n\n¦"],
    ["ab¦cd", "ab\n\n¦cd"],
    ["Text\n\n¦***\n\nNext", "Text\n\n***\n\n¦\n\nNext"],
    ["first¦\nsecond", "first\n\n¦\nsecond"],
    ["::: note Title\nab¦cd\n:::", "::: note Title\nab\n\n¦cd\n:::"],
  ])("inserts a paragraph without rewriting surrounding source: %s", (source, result) => {
    const state = fixture(source), spec = insertDocumentParagraph(state);
    expect(spec).not.toBeNull();
    const next = state.update(spec!).state;
    expect(next.doc.toString()).toBe(result.replace("¦", ""));
    expect(next.selection.main.head).toBe(result.indexOf("¦"));
  });

  it.each(["- item¦", "> quote¦", "```text\ncode¦\n```", "> ```text\n> code\n> ```¦", "- ```text\n  code\n  ```¦", "    code¦", "::: note Title¦\ntext\n:::", "¦", "| a | b¦ |\n| --- | --- |"])("keeps native continuation for %s", source => {
    expect(insertDocumentParagraph(fixture(source))).toBeNull();
  });

  it.each([
    ["```text\nco¦de\n```", "```text\ncode\n```\n\n"],
    ["::: note Title\nTe¦xt\n:::", "::: note Title\nText\n:::\n\n"],
    ["| a¦ | b |\n| --- | --- |", "| a | b |\n| --- | --- |\n\n"],
    ["- one¦\n- two", "- one\n- two\n\n"],
    ["> ```text\n> co¦de\n> ```", "> ```text\n> code\n> ```\n> \n> "],
    ["> - ```text\n>   co¦de\n>   ```", "> - ```text\n>   code\n>   ```\n>   \n>   "],
    ["---\ntitle: Te¦st\n---", "---\ntitle: Test\n---\n\n"],
  ])("exits the nearest complete block through Mod-Enter", (source, result) => {
    const state = fixture(source), next = state.update(exitDocumentBlock(state)!).state;
    expect(next.doc.toString()).toBe(result);
    expect(next.selection.main.head).toBe(result.length);
  });

  it("does not treat an unclosed code/container as a completed block", () => {
    expect(exitDocumentBlock(fixture("```text\ncode¦"))).toBeNull();
    expect(exitDocumentBlock(fixture("::: note Title\nbody¦"))).toBeNull();
    expect(exitDocumentBlock(fixture("---\ntitle: Test¦"))).toBeNull();
  });

  it("respects readonly, source and composition", () => {
    const original = fixture("text¦");
    for (const state of [
      original.update({ effects: StateEffect.appendConfig.of(EditorState.readOnly.of(true)) }).state,
      ...(["source", "locked"] as const).map(mode => EditorState.create({ doc: "text", selection: { anchor: 4 },
        extensions: [markdown(), modeFacet.of(mode), sourceRevealSetting.extension(() => "hidden")] })),
    ]) {
      expect(insertDocumentParagraph(state)).toBeNull();
      expect(exitDocumentBlock(state)).toBeNull();
    }
    expect(insertDocumentParagraph(original.update({ effects: compositionEffect.of(true) }).state)).toBeNull();
  });

  it.each([
    ["first selected last", "selected", "first \n\n last"],
    ["first tail\n\nsecond last", "tail\n\nsecond", "first \n\n last"],
    ["selected last", "selected", "\n\n last"],
    ["selected", "selected", "\n\n"],
    ["## first selected last", "selected", "## first \n\n last"],
    ["::: note Title\nfirst selected last\n:::", "selected", "::: note Title\nfirst \n\n last\n:::"],
  ])("replaces a forward or backward prose selection without trimming source: %s", (source, selected, expected) => {
    const from = source.indexOf(selected), to = from + selected.length;
    for (const reverse of [false, true]) {
      const state = fixture(`${source}¦`).update({ selection: { anchor: reverse ? to : from, head: reverse ? from : to } }).state;
      const spec = insertDocumentParagraph(state);
      expect(spec).not.toBeNull();
      const next = state.update(spec!).state;
      expect(next.doc.toString()).toBe(expected);
      expect(next.selection.main.head).toBe(from + 2);
    }
  });

  it.each(["```text\nselected\n```", "> selected", "- selected", "| selected | b |\n| --- | --- |"])(
    "leaves selected code, quote, list and table content to its native continuation: %s", source => {
      const from = source.indexOf("selected");
      const state = fixture(`${source}¦`).update({ selection: { anchor: from, head: from + 8 } }).state;
      expect(insertDocumentParagraph(state)).toBeNull();
    },
  );

  it("shares paragraph input with Markdown editing while preserving source-only input", () => {
    const state = parsed(EditorState.create({ doc: "text", selection: { anchor: 4 },
      extensions: [markdown(), modeFacet.of("live"), sourceRevealSetting.extension(() => "selection")] }));
    expect(state.update(insertDocumentParagraph(state)!).state.doc.toString()).toBe("text\n\n");
  });

  it.each([
    ["text¦", "text  \n¦"], ["text ¦", "text  \n¦"], ["text  ¦", "text  \n¦"],
    ["> text¦", "> text  \n> ¦"], ["- text¦", "- text  \n  ¦"],
    ["> - text¦", "> - text  \n>   ¦"], ["## text¦", "## text  \n¦"],
    ["> ## text¦", "> ## text  \n> ¦"], ["- [x] task¦", "- [x] task  \n  ¦"],
  ])("inserts a hard break without splitting its enclosing block: %s", (source, result) => {
    const state = fixture(source), next = state.update(insertDocumentLineBreak(state)!).state;
    expect(next.doc.toString()).toBe(result.replace("¦", ""));
    expect(next.selection.main.head).toBe(result.indexOf("¦"));
  });

  it.each(["```text\ncode¦\n```", "| a¦ | b |\n| --- | --- |"])("keeps literal code/table editing for Shift-Enter: %s", source => {
    expect(insertDocumentLineBreak(fixture(source))).toBeNull();
  });

  it("maps multiple supported carets in one source transaction", () => {
    const base = fixture("first¦\n\nsecond");
    const state = parsed(EditorState.create({ doc: base.doc, selection: EditorSelection.create([EditorSelection.cursor(5), EditorSelection.cursor(13)]),
      extensions: [EditorState.allowMultipleSelections.of(true), markdown(), modeFacet.of("live"), sourceRevealSetting.extension(() => "hidden")] }));
    const next = state.update(insertDocumentParagraph(state)!).state;
    expect(next.doc.toString()).toBe("first\n\n\n\nsecond\n\n");
    expect(next.selection.ranges.map(range => range.head)).toEqual([7, 17]);
  });

  it("replaces multiple prose selections atomically and preserves their direction-independent targets", () => {
    const doc = "first selected last\n\nsecond selected last", second = doc.lastIndexOf("selected");
    const state = parsed(EditorState.create({ doc,
      selection: EditorSelection.create([EditorSelection.range(6, 14), EditorSelection.range(second + 8, second)]),
      extensions: [EditorState.allowMultipleSelections.of(true), markdown(), modeFacet.of("live")] }));
    const next = state.update(insertDocumentParagraph(state)!).state;
    expect(next.doc.toString()).toBe("first \n\n last\n\nsecond \n\n last");
    expect(next.selection.ranges.map(range => range.head)).toEqual([8, 24]);
  });

  it("does not partially replace a mixed prose and code selection", () => {
    const state = parsed(EditorState.create({ doc: "selected\n\n```text\nselected\n```",
      selection: EditorSelection.create([EditorSelection.range(0, 8), EditorSelection.range(18, 26)]),
      extensions: [EditorState.allowMultipleSelections.of(true), markdown(), modeFacet.of("live")] }));
    expect(insertDocumentParagraph(state)).toBeNull();
  });
});

describe("Enter on a visible empty row after a block", () => {
  it.each([
    ["```js\na\n```\n¦", "```js\na\n```\n\n\n¦"],
    ["| a |\n| - |\n| 1 |\n¦", "| a |\n| - |\n| 1 |\n\n\n¦"],
  ])("inserts two breaks so the caret visibly moves: %s", (source, expected) => {
    const before = fixture(source), spec = openBlankRow(before);
    expect(spec).not.toBeNull();
    const after = before.update(spec!).state, doc = after.doc.toString(), head = after.selection.main.head;
    expect(doc.slice(0, head) + "¦" + doc.slice(head)).toBe(expected);
  });

  it.each(["Text\n\n¦", "¦", "Text¦"])("leaves other rows to native Enter: %s", source => expect(openBlankRow(fixture(source))).toBeNull());
});
