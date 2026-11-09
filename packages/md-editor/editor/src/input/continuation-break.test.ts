import { describe, expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { modeFacet } from "@quirekit/msfe-core/state";
import { continueDocumentMarkup } from "./continuation";

/** @param source - Markdown with one ¦ caret. @returns Source after Enter, with the caret. */
function enter(source: string): string {
  const before = EditorState.create({ doc: source.replace("¦", ""), selection: { anchor: source.indexOf("¦") },
    extensions: [markdown({ extensions: GFM }), modeFacet.of("live")] });
  ensureSyntaxTree(before, before.doc.length, 5000);
  const after = before.update(continueDocumentMarkup(before)!).state, doc = after.doc.toString(), head = after.selection.main.head;
  return doc.slice(0, head) + "¦" + doc.slice(head);
}

describe("Enter on a list item's line after a hard break", () => {
  it.each([
    ["- a  \n  x¦", "- a  \n  x\n- ¦"],
    ["- a  \n  x¦y", "- a  \n  x\n- ¦y"],
    ["1. a  \n   x¦\n2. b", "1. a  \n   x\n2. ¦\n3. b"],
    ["- [x] a  \n  x¦", "- [x] a  \n  x\n- [ ] ¦"],
    ["- a  \n  ¦", "- a\n- ¦"],
    ["- a  \n  ¦\n- b", "- a\n- ¦\n- b"],
  ])("%j → %j", (source, expected) => expect(enter(source)).toBe(expected));
});
