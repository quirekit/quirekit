import { describe, expect, it } from "vitest";
import { TreeFragment } from "@lezer/common";
import { parser } from "@quirekit/lezer-markdown";
import { getReferenceParseWork, ReferenceMarkdownParser, referencesPending } from "./references";

describe("reference-aware native parser lifecycle", () => {
  it("shares dense reference summaries instead of copying and comparing every definition on input", () => {
    const grammar = new ReferenceMarkdownParser(parser);
    let source = Array.from({ length: 1000 }, (_, index) => `paragraph ${index}\n\n[id-${index}]: /target-${index}\n\n`).join("");
    let tree = grammar.parse(source);
    for (const paragraph of [500, 0, 999, 501]) {
      const from = source.indexOf(`paragraph ${paragraph}`) + 3;
      source = source.slice(0, from) + "x" + source.slice(from);
      tree = grammar.parse(source, TreeFragment.applyChanges(TreeFragment.addTree(tree),
        [{ fromA: from, toA: from, fromB: from, toB: from + 1 }]));
      expect(tree.toString()).toBe(grammar.parse(source).toString());
      const work = getReferenceParseWork(tree)!;
      expect(work.copiedDefinitions).toBe(0);
      expect(work.definitionComparisons).toBeLessThan(10);
      expect(work.labelBuilds).toBe(0);
    }
  });

  it("does not rebuild definition labels or copy a single retained definition after ordinary input", () => {
    const grammar = new ReferenceMarkdownParser(parser);
    const source = `${"ordinary paragraph\n\n".repeat(2500)}[id]: /target\n\n${"following paragraph\n\n".repeat(2500)}`;
    const before = grammar.parse(source), from = 20001;
    const edited = grammar.parse(source.slice(0, from) + "x" + source.slice(from),
      TreeFragment.applyChanges(TreeFragment.addTree(before), [{ fromA: from, toA: from, fromB: from, toB: from + 1 }]));
    const work = getReferenceParseWork(edited)!;
    expect(work.definitionsRead).toBe(0);
    expect(work.copiedDefinitions).toBe(0);
    expect(work.labelBuilds).toBe(0);
    expect(work.labelReads).toBe(0);
  });

  it("reuses certified blocks after text edits and destination-only changes", () => {
    const grammar = new ReferenceMarkdownParser(parser);
    const source = `${Array.from({ length: 3000 }, (_, index) => `Paragraph ${index}: [first][missing][id].\n\n`).join("")}[id]: /one`;
    const original = grammar.parse(source), initial = getReferenceParseWork(original)!;
    expect(initial.checkedBlocks).toBe(3000);
    const edit = [{ fromA: 5, toA: 5, fromB: 5, toB: 6 }];
    const updatedSource = source.slice(0, 5) + "x" + source.slice(5);
    const updated = grammar.parse(updatedSource, TreeFragment.applyChanges(TreeFragment.addTree(original), edit));
    const local = getReferenceParseWork(updated)!;
    expect(local.checkedBlocks).toBeLessThan(10);
    expect(local.visitedChunks).toBeLessThan(initial.visitedChunks / 2);
    expect(local.refinements).toBe(0);
    expect(updated.toString()).toBe(grammar.parse(updatedSource).toString());
    const end = source.length, urlChange = [{ fromA: end - 3, toA: end, fromB: end - 3, toB: end }];
    const destination = grammar.parse(source.slice(0, -3) + "two", TreeFragment.applyChanges(TreeFragment.addTree(original), urlChange));
    expect(getReferenceParseWork(destination)!.checkedBlocks).toBeLessThan(10);
    expect(getReferenceParseWork(destination)!.labelBuilds).toBe(0);
  });

  it("keeps partial definition knowledge pending and converges from stopped fragments", () => {
    const grammar = new ReferenceMarkdownParser(parser), source = `[foo][bar][id]\n\n${"ordinary paragraph\n\n".repeat(2000)}[id]: /end`;
    const partial = grammar.startParse(source); partial.stopAt(1000);
    let prefix; while (!(prefix = partial.advance())) { expect(partial.parsedPos).toBe(0); }
    expect(prefix.length).toBeLessThan(source.length);
    expect(referencesPending(prefix)).toBe(true);
    const complete = grammar.parse(source, TreeFragment.addTree(prefix, [], true));
    expect(referencesPending(complete)).toBe(false);
    expect(complete.topNode.firstChild!.getChild("Link")!.from).toBe(5);
    expect(complete.toString()).toBe(grammar.parse(source).toString());
  });

  it("keeps installed inline syntax, native nesting and destination envelopes", () => {
    const grammar = new ReferenceMarkdownParser(parser);
    for (const source of ['[x](url "title ) here")', '[x](a(b)c)', '[x](<a(b)> "T")', '![image [outer [inner](url)]](img.png)',
      '[x](url\n\t"title")', '[x]( "title")', '[x](a\\)b)', '[x]()']) {
      expect(grammar.parse(source).toString()).toBe(parser.parse(source).toString());
    }
  });

  it("resolves references elsewhere when an edit adds, removes or renames their definition", () => {
    const grammar = new ReferenceMarkdownParser(parser);
    const edit = (source: string, tree: ReturnType<typeof grammar.parse>, from: number, to: number, insert: string) => {
      const next = source.slice(0, from) + insert + source.slice(to);
      const updated = grammar.parse(next, TreeFragment.applyChanges(TreeFragment.addTree(tree), [{ fromA: from, toA: to, fromB: from, toB: from + insert.length }]));
      expect(updated.toString()).toBe(new ReferenceMarkdownParser(parser).parse(next).toString());
      return { source: next, tree: updated };
    };
    let source = "See [target] here.\n\n" + "plain paragraph\n\n".repeat(200) + "end\n";
    let state = { source, tree: grammar.parse(source) };
    state = edit(state.source, state.tree, state.source.length, state.source.length, "\n[target]: /url\n");
    expect(state.tree.toString()).toContain("Link");
    const label = state.source.lastIndexOf("target");
    state = edit(state.source, state.tree, label, label + 6, "renamed");
    expect(state.tree.topNode.firstChild!.toString()).not.toContain("Link");
    const renamed = state.source.lastIndexOf("renamed");
    state = edit(state.source, state.tree, renamed, renamed + 7, "target");
    expect(state.tree.topNode.firstChild!.toString()).toContain("Link");
    state = edit(state.source, state.tree, 5, 5, "x");
    state = edit(state.source, state.tree, 5, 6, "");
    expect(state.tree.topNode.firstChild!.toString()).toContain("Link");
  });
});
