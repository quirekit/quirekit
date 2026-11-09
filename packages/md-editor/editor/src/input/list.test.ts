import { describe, expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { modeFacet } from "@quirekit/msfe-core/state";
import { deleteListMarkupBackward, exitEmptyListItem } from "./list";
import { deleteForward } from "./edges/forward";
import { continueDocumentMarkup } from "./continuation";

/** @param source - Markdown with one ¦ caret. @param mode - Presentation mode. @returns State with a complete syntax tree. */
function state(source: string, mode: "live" | "source" = "live"): EditorState {
  const value = EditorState.create({ doc: source.replace("¦", ""), selection: { anchor: source.indexOf("¦") },
    extensions: [markdown({ extensions: GFM }), modeFacet.of(mode)] });
  ensureSyntaxTree(value, value.doc.length, 5000);
  return value;
}

/** @param command - List gesture. @param source - Input with caret. @param mode - Presentation mode. @returns Output with caret, or null. */
function run(command: (state: EditorState) => ReturnType<typeof deleteListMarkupBackward>, source: string, mode: "live" | "source" = "live"): string | null {
  const before = state(source, mode), spec = command(before);
  if (!spec) return null;
  const after = before.update(spec).state, doc = after.doc.toString(), head = after.selection.main.head;
  return doc.slice(0, head) + "¦" + doc.slice(head);
}

describe("Backspace at a list item's text start", () => {
  it.each([
    ["- a\n- ¦", "- a\n\n¦"],
    ["- a\n  - b\n  - ¦\n- c", "- a\n  - b\n- ¦\n- c"],
    ["- a\n  - ¦", "- a\n- ¦"],
    ["- [ ] a\n- [ ] ¦", "- [ ] a\n\n¦"],
    ["- ¦\n- b", "¦\n\n- b"],
    ["- a\n- ¦b", "- a\n\n¦b"],
    ["- ¦a\n- b", "¦a\n\n- b"],
    ["- a\n  - ¦b", "- a\n- ¦b"],
    ["1. a\n2. ¦b\n3. c", "1. a\n\n¦b\n\n2. c"],
    ["- [ ] a\n- [ ] ¦b", "- [ ] a\n\n¦b"],
    ["- [ ] a\n  - [ ] ¦b", "- [ ] a\n- [ ] ¦b"],
    ["- a\n-   ¦", "- a\n\n¦"],
    ["- a\n\n¦", "- a¦"],
    ["- a\n  - b\n\n¦\n\n- c", "- a\n  - b¦\n- c"],
    ["- a\n\n¦\n\nx", "- a¦\n\nx"],
    ["- a\n\n¦b", "- a¦b"],
    ["- [x] a\n\n¦b", "- [x] a¦b"],
  ])("peels one layer: %s", (source, expected) => expect(run(deleteListMarkupBackward, source)).toBe(expected));

  it("deletes only the visible marker in source mode", () => {
    expect(run(deleteListMarkupBackward, "- a\n- ¦", "source")).toBe("- a\n¦");
    expect(run(deleteListMarkupBackward, "- a\n\n¦b", "source")).toBeNull();
  });

  it.each(["- a¦", "- a\n- b¦c", "a\n\n¦b", "```\n- a\n```\n\n¦b", "```\n- a\n\n¦\n```"])("keeps native deletion elsewhere: %s", source => {
    expect(run(deleteListMarkupBackward, source)).toBeNull();
  });
});

describe("Delete at the end of text before a list item", () => {
  it.each([
    ["- a¦\n- b", "- a¦b"],
    ["- a¦\n  - b", "- a¦b"],
    ["- [ ] a¦\n- [x] b", "- [ ] a¦b"],
    ["a¦\n\n- b", "a¦b"],
  ])("joins the item text without its marker: %s", (source, expected) => expect(run(deleteForward, source)).toBe(expected));

  it.each([
    ["- 一\n- ¦\n- 三", "- 一\n- ¦三"],
    ["1. 一\n2. ¦\n3. 三\n4. 四", "1. 一\n2. ¦三\n3. 四"],
    ["- 一\n  - ¦\n    - 子\n- 三", "- 一\n  - ¦子\n- 三"],
    ["> 甲\n> ¦\n\n后文", "> 甲\n\n¦后文"],
  ])("removes an empty item or quote row and keeps the next block: %s", (source, expected) => expect(run(deleteForward, source)).toBe(expected));

  it.each([
    ["前文¦\n\n1. 一\n2. 二\n3. 三", "前文¦一\n\n1. 二\n2. 三"],
    ["前文¦\n\n- 一\n  - 二\n- 三", "前文¦一\n\n- 二\n- 三"],
    ["前文¦\n\n> 甲乙\n> 丙丁", "前文¦甲乙\n\n> 丙丁"],
    ["前文¦\n\n> 甲", "前文¦甲"],
  ])("keeps what remains of the next block after joining its first line: %s", (source, expected) => expect(run(deleteForward, source)).toBe(expected));

  it.each(["- a¦\n\nb", "- a¦b", "> a¦\n> - b"])("keeps native deletion elsewhere: %s", source => {
    expect(run(deleteForward, source)).toBeNull();
  });
  it("keeps native deletion in source mode", () => expect(run(deleteForward, "- a¦\n- b", "source")).toBeNull());
});

describe("Enter on an empty item between siblings", () => {
  it.each([
    ["- a\n- ¦\n- c", "- a\n\n¦\n\n- c"],
    ["1. a\n2. ¦\n3. c", "1. a\n\n¦\n\n2. c"],
  ])("splits the list around a paragraph: %s", (source, expected) => {
    expect(run(exitEmptyListItem, source)).toBe(expected);
    expect(run(continueDocumentMarkup, source)).toBe(expected);
  });
  it.each([
    ["- a\n  - ¦\n  - c", "- a\n- ¦\n  - c"],
    ["- A\n  - B\n    - ¦\n      - D\n    - E", "- A\n  - B\n  - ¦\n    - D\n    - E"],
    ["- A\n- ¦\n  - D", "- A\n\n¦\n\n- D"],
    ["- A\n- ¦\n  - D\n- E", "- A\n\n¦\n\n- D\n- E"],
  ])("outdents an empty item together with its children: %s", (source, expected) => {
    expect(run(continueDocumentMarkup, source)).toBe(expected);
  });
  it.each(["- a\n- ¦", "- a\n- b¦\n- c"])("leaves other items to native continuation: %s", source => {
    expect(run(exitEmptyListItem, source)).toBeNull();
  });
});
