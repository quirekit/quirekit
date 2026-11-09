import { expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { ensureSyntaxTree, syntaxTree } from "@quirekit/cm-language";
import { GFM } from "@quirekit/lezer-markdown";
import type { ProjectionContext } from "@quirekit/msfe-core";
import { projectTable } from "./projection";

/** @param lead - Text placed before the table. @returns Row line attributes projected for that document. */
function rowAttributes(lead: string) {
  const doc = `${lead}\n\n| A | B |\n| --- | --- |\n| one | two |`;
  const state = EditorState.create({ doc, extensions: markdown({ extensions: GFM }) });
  ensureSyntaxTree(state, doc.length, 1000);
  const node = syntaxTree(state).topNode.getChild("Table")!;
  const ranges = projectTable({ state, node, from: 0, to: doc.length, active: false, selection: state.selection, mode: "live" } as unknown as ProjectionContext);
  return ranges.map(range => range.value.spec.attributes as unknown).filter(Boolean).filter(value => "style" in (value as object) && String((value as { style: string }).style).startsWith("--msfe-table-columns"));
}

it("keeps row decorations identical when text before the table shifts it", () => {
  const before = rowAttributes("short"), after = rowAttributes("a longer paragraph");
  expect(before.length).toBeGreaterThan(0);
  expect(after).toEqual(before);
});
