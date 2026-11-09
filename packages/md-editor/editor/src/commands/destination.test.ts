import { describe, expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { syntaxTree } from "@quirekit/cm-language";
import { GFM } from "@quirekit/lezer-markdown";
import { canEditMdLink, editMdDestination, removeMdLink } from "./destination";
import { toggleMdList } from "./list";

describe("Markdown product commands", () => {
  it("changes one reference usage, retaining formatted labels and the shared definition", () => {
    const doc = "[**kept**][shared] and [second][shared]\n\n[shared]: /old \"title\"";
    const state = EditorState.create({ doc, selection: { anchor: 5 }, extensions: markdown() });
    const next = state.update(editMdDestination(false, { url: "/new" })(state)!).state;
    expect(next.doc.toString()).toBe("[**kept**](/new \"title\") and [second][shared]\n\n[shared]: /old \"title\"");
    expect(editMdDestination(false, { url: "javascript:alert(1)" })(state)).toBeNull();
  });
  it("escapes explicitly changed labels and image destinations", () => {
    const state = EditorState.create({ doc: "image", selection: { anchor: 0, head: 5 }, extensions: markdown() });
    const next = state.update(editMdDestination(true, { url: "/image%20(1).svg", label: "[diagram]" })(state)!).state;
    expect(next.doc.toString()).toBe("![\\[diagram\\]](</image%20(1).svg>)");
  });
  it("uses the destination as a new link's visible label while allowing decorative image alt text", () => {
    const state = EditorState.create({ extensions: markdown() });
    expect(state.update(editMdDestination(false, { url: "/guide", label: "" })(state)!).state.doc.toString()).toBe("[/guide](/guide)");
    expect(state.update(editMdDestination(true, { url: "/logo.svg", label: "" })(state)!).state.doc.toString()).toBe("![](/logo.svg)");
  });
  it("converts real paragraphs and preserves nested quote/list structure", () => {
    const doc = "> - [x] first\n>   - nested\n> - third";
    const state = EditorState.create({ doc, selection: { anchor: 8 }, extensions: markdown() });
    const next = state.update(toggleMdList("ordered")(state)!).state;
    expect(next.doc.toString()).toBe("> 1. first\n>    - nested\n> 2. third");
    expect(syntaxTree(next).toString()).toContain("ListItem(ListMark,Paragraph,QuoteMark,BulletList");
    expect(next.update(toggleMdList("ordered")(next)!).state.doc.toString()).toBe("> first\n> - nested\n>\n> 1. third");
    const code = EditorState.create({ doc: "```\nsource\n```", selection: { anchor: 5 }, extensions: markdown() });
    expect(toggleMdList("bullet")(code)).toBeNull();
  });
});

it("refuses nested links, code, split formatting and selections across blocks", () => {
  for (const [doc, from, to] of [
    ["```\ncode\n```", 5, 7], ["```\n\n```", 4, 4], ["one\n\ntwo", 1, 7], ["before [linked](/old) after", 0, 25],
    ["**first second** after", 8, 20], ["`inline`", 2, 4],
  ] as const) {
    const state = EditorState.create({ doc, selection: { anchor: from, head: to }, extensions: markdown() });
    expect(canEditMdLink(state), doc).toBe(false);
    expect(editMdDestination(false, { url: "/new" })(state), doc).toBeNull();
  }
});

it("retains inline formatting when linking selected content", () => {
  const state = EditorState.create({ doc: "**formatted**", selection: { anchor: 0, head: 13 }, extensions: markdown() });
  expect(state.update(editMdDestination(false, { url: "#chapter" })(state)!).state.doc.toString()).toBe("[**formatted**](#chapter)");
});

it("unlinks one usage while preserving label formatting and shared references", () => {
  const state = EditorState.create({ doc: "[**kept**][shared] and [second][shared]\n\n[shared]: /old", selection: { anchor: 4 }, extensions: markdown() });
  expect(state.update(removeMdLink()(state)!).state.doc.toString()).toBe("**kept** and [second][shared]\n\n[shared]: /old");
});

it("unlinks addresses without immediately creating the same GFM link again", () => {
  for (const [doc, expected] of [
    ["<https://example.com>", "https\\://example\\.com"],
    ["https://example.com", "https\\://example\\.com"],
    ["[https://example.com](/old)", "https\\://example\\.com"],
    ["<name@example.com>", "name\\@example\\.com"],
  ] as const) {
    const state = EditorState.create({ doc, selection: { anchor: 5 }, extensions: markdown({ extensions: GFM }) });
    const next = state.update(removeMdLink()(state)!).state;
    expect(syntaxTree(next).toString(), doc).not.toMatch(/Autolink|URL/);
    expect(next.doc.toString()).toBe(expected);
  }
});

it("edits the owning automatic link when the caret is inside its URL token", () => {
  const state = EditorState.create({ doc: "<https://example.com>", selection: { anchor: 5 }, extensions: markdown() });
  expect(state.update(editMdDestination(false, { url: "/new" })(state)!).state.doc.toString()).toBe("[https://example.com](/new)");
});
