import { describe, expect, it, vi } from "vitest";
import { EditorState, type ChangeSpec } from "@quirekit/cm-state";
import { NodeType, Tree, TreeFragment } from "@lezer/common";
import { GFM, MarkdownParser, parseCode, parser } from "@quirekit/lezer-markdown";
import { getReferenceParseWork, ReferenceMarkdownParser } from "../../markdown/parsing/references";
import { changedTreeRanges } from "./changes";
import { createSyntaxReuseMatcher } from "./reuse";

/** @param tree - Native root. @returns Complete semantic node names and source spans. */
function shape(tree: Tree): string[] {
  const result: string[] = [];
  tree.iterate({ enter(node) { result.push(`${node.name}:${node.from}:${node.to}`); } });
  return result;
}

/** @param source - Old text. @param changes - One or more exact source edits. @param grammar - Configured native parser.
 * @param before - Optional existing parse. @returns Incremental result checked against complete parsing and the unoptimized diff. */
function compare(source: string, changes: ChangeSpec, grammar = new ReferenceMarkdownParser(parser.configure(GFM)), before = grammar.parse(source)) {
  const transaction = EditorState.create({ doc: source }).update({ changes });
  const edits: { fromA: number; toA: number; fromB: number; toB: number }[] = [];
  transaction.changes.iterChangedRanges((fromA, toA, fromB, toB) => edits.push({ fromA, toA, fromB, toB }));
  const next = transaction.newDoc.toString();
  const after = grammar.parse(next, TreeFragment.applyChanges(TreeFragment.addTree(before), edits));
  expect(shape(after)).toEqual(shape(new ReferenceMarkdownParser(parser.configure(GFM)).parse(next)));
  // A fresh root has identical children but no weak proof. It forces the existing
  // exhaustive native-identity diff without adding a production bypass switch.
  const unobserved = new Tree(after.type, after.children, after.positions, after.length, after.propValues);
  const work = { builds: 0, visitedChunks: 0, comparedChunks: 0, reuseChecks: 0, reuseMappings: 0 };
  const ranges = changedTreeRanges(before, after, transaction.changes, next.length, work);
  expect(ranges).toEqual(changedTreeRanges(before, unobserved, transaction.changes, next.length));
  return { after, source: next, work, ranges };
}

describe("committed native block reuse", () => {
  it("observes two exact adopted runs without reading or indexing all chunks", () => {
    const source = "paragraph\nsecond line\n\n".repeat(10000), before = parser.parse(source), from = source.length / 2 + 4;
    const next = source.slice(0, from) + "x" + source.slice(from);
    const after = parser.parse(next, TreeFragment.applyChanges(TreeFragment.addTree(before), [{ fromA: from, toA: from, fromB: from, toB: from + 1 }]));
    const proof = MarkdownParser.getBlockReuse(after)!;
    expect(proof.count).toBe(2);
    for (const range of proof.get(before)!) {
      expect(source.slice(range.from + range.offset, range.to + range.offset)).toBe(next.slice(range.from, range.to));
      expect(range.to <= from || range.from > from).toBe(true);
    }
    expect(proof.get(parser.parse(source))).toBeUndefined();
  });

  it("falls back when the optional native observer is unavailable", () => {
    const observer = vi.spyOn(MarkdownParser, "getBlockReuse").mockReturnValue(undefined);
    try {
      const result = compare("paragraph\n\n".repeat(1000), { from: 1500, insert: "x" });
      expect(result.work.reuseChecks).toBe(0);
      expect(result.work.visitedChunks).toBeGreaterThan(0);
    } finally { observer.mockRestore(); }
  });

  it("requires this exact source mapping and preserves zero-length boundary fallback", () => {
    const source = "paragraph\n\n".repeat(1000), before = parser.parse(source), from = 5000;
    const after = parser.parse(source.slice(0, from) + "x" + source.slice(from), TreeFragment.applyChanges(TreeFragment.addTree(before),
      [{ fromA: from, toA: from, fromB: from, toB: from + 1 }]));
    const wrong = EditorState.create({ doc: source }).update({ changes: { from: 0, insert: "x" } });
    const match = createSyntaxReuseMatcher(before, after, wrong.changes,
      { builds: 0, visitedChunks: 0, comparedChunks: 0, reuseChecks: 0, reuseMappings: 0 });
    expect(match(10, 10)).toBe(false);
    expect(match(10, 20)).toBe(false);
  });

  it.each([0, 10])("does not hide a new zero-length child at adopted boundary %i", position => {
    const type = NodeType.define({ id: 1, name: "Block" }), mark = NodeType.define({ id: 2, name: "Boundary" });
    const block = new Tree(type, [], [], 10), before = new Tree(type, [block], [0], 10);
    const point = new Tree(mark, [], [], 0);
    const group = new Tree(NodeType.none, position ? [block, point] : [point, block], position ? [0, 10] : [0, 0], 10);
    const after = new Tree(type, [group], [0], 10);
    const observer = vi.spyOn(MarkdownParser, "getBlockReuse").mockImplementation(tree => tree === after ? {
      count: 1, get: root => root === before ? [{ from: 0, to: 10, offset: 0 }] : undefined,
    } : undefined);
    try {
      const unchanged = EditorState.create({ doc: "0123456789" }).update({}).changes;
      expect(changedTreeRanges(before, after, unchanged, 10)).toEqual([{ from: position, to: position }]);
    } finally { observer.mockRestore(); }
  });

  it("intersects structural and reference refinement adoption around distant dependencies", () => {
    const source = `[label][missing][key]\n\n${"ordinary paragraph\n\n".repeat(600)}[key]: /one\n\n${"ending paragraph\n\n".repeat(600)}`;
    const from = source.indexOf("[key]:");
    const result = compare(source, { from: from + 1, to: from + 4, insert: "missing" });
    expect(result.ranges[0]!.from).toBe(0);
    const work = getReferenceParseWork(result.after)!;
    expect(work.refinements).toBe(1);
    expect(work.adoptedRanges).toBeGreaterThan(0);
    expect(work.composedRanges).toBeGreaterThan(0);
    expect(result.work.visitedChunks).toBeLessThan(150);
  });

  it("keeps NotLast rollback, rebuilt ancestors and multiple source edits conservative", () => {
    const sections = ["- first\n\n    continuation\n\n- second", "    indented\n\n    continued", "> quote\n>\n> next",
      "```js\nconst n = 1\n```", "# heading\n\nparagraph", "| A | B |\n| --- | --- |\n| a | b |", "[key]: /one\n\n[text][key]"];
    for (const section of sections) {
      const prefix = "before paragraph\n\n".repeat(100), suffix = "\n\nafter paragraph\n\n".repeat(100);
      const source = prefix + section + suffix;
      for (const offset of [0, section.indexOf("\n"), section.length]) {
        const from = prefix.length + offset;
        compare(source, { from, to: Math.min(from + 1, source.length), insert: offset ? "\n\n" : "> " });
      }
      compare(source, [{ from: 3, insert: "x" }, { from: prefix.length + 3, insert: "\n```\n" },
        { from: source.length - 9, to: source.length - 3 }]);
    }
  });

  it("omits stopped and gapped proofs, and resumes against the complete oracle", () => {
    const source = "paragraph\nsecond line\n\n".repeat(1000), before = parser.parse(source);
    const partial = parser.startParse(source, TreeFragment.addTree(before)); partial.stopAt(100);
    let prefix: Tree | null = null; while (!prefix) prefix = partial.advance();
    expect(MarkdownParser.getBlockReuse(prefix)).toBeUndefined();
    const gapped = parser.parse(source, TreeFragment.addTree(before), [{ from: 0, to: 100 }, { from: 200, to: source.length }]);
    expect(MarkdownParser.getBlockReuse(gapped)).toBeUndefined();
    compare(source, { from: 50, insert: "x" }, new ReferenceMarkdownParser(parser.configure(GFM)), prefix);
  });

  it("preserves native mixed-language mounts without certifying a replacement wrapper root", () => {
    const base = parser.configure([GFM, parseCode({ codeParser: () => parser })]);
    const grammar = new ReferenceMarkdownParser(base);
    const source = `${"before\n\n".repeat(100)}\`\`\`md\n# inside\n\`\`\`\n\n${"after\n\n".repeat(100)}`;
    const from = 15, before = grammar.parse(source), next = source.slice(0, from) + "x" + source.slice(from);
    const after = grammar.parse(next, TreeFragment.applyChanges(TreeFragment.addTree(before), [{ fromA: from, toA: from, fromB: from, toB: from + 1 }]));
    expect(shape(after)).toEqual(shape(new ReferenceMarkdownParser(base).parse(next)));
    expect(MarkdownParser.getBlockReuse(after)).toBeDefined();
    expect(MarkdownParser.getBlockReuse(new Tree(after.type, after.children, after.positions, after.length))).toBeUndefined();
  });

  it("matches exhaustive dirty ranges and full parsing throughout deterministic mixed edits", () => {
    const grammar = new ReferenceMarkdownParser(parser.configure(GFM));
    let source = Array.from({ length: 80 }, (_, i) => `# Heading ${i}\n\n[text][key]\n\n- [ ] task\n  - child\n\n> quote\n> next\n\n\`\`\`js\ncode\n\`\`\`\n\n`).join("") + "[key]: /one\n";
    let before = grammar.parse(source), seed = 731;
    for (let step = 0; step < 240; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const from = seed % source.length, insert = ["x", "\n", "\n\n", "```", "> ", "- ", "[key]: /two\n", ""][step % 8]!;
      const result = compare(source, { from, to: Math.min(source.length, from + step % 4), insert }, grammar, before);
      source = result.source; before = result.after;
    }
  });
});
