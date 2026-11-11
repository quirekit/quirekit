import { type EditorState, type Range } from "@quirekit/cm-state";
import { BlockWrapper } from "@quirekit/cm-view";
import { syntaxTree } from "@quirekit/cm-language";
import { touchesSourceRanges, type MsfeSourceRange } from "@quirekit/msfe-core";
import { TABLE_SCROLL_ATTRIBUTE } from "@quirekit/msfe-prose";
import { containerTone, highlightAttributes } from "../projection/container";
import { bareListItem, bareMarker } from "../projection/marks";
import type { ProseStructureWork } from "./types";

/**
 * Project canonical ranges into real nested DOM blocks, without moving editable lines.
 * @param state - The sole source document and accepted parse.
 * @param dirty - Complete syntax blocks requiring new roles.
 * @param work - Actual projection work for this state lineage.
 * @returns Shared Prose roles consumed by the public stylesheet.
 */
export function buildProseStructure(state: EditorState, dirty: readonly MsfeSourceRange[], work: ProseStructureWork): Range<BlockWrapper>[] {
  const ranges: Range<BlockWrapper>[] = [];
  const seen = new Set<string>();
  /** @param from - First owned line. @param to - Exclusive end. @param attributes - Public semantic anatomy. @param tagName - Native compatible tag. @param rank - Tie-breaking containment. @param empty - Also wrap one empty line. */
  function wrap(from: number, to: number, attributes: Record<string, string>, tagName = "div", rank = 50, empty = false): void {
    // Longer ancestors precede descendants; equal source intervals use semantic
    // role order (list > item > paragraph). Deep nesting does not exhaust ranks.
    const precedence = 100 - 100 / (to - from + 2 - rank / 100);
    if (to > from || empty && to === from) ranges.push(BlockWrapper.create({ tagName, attributes, rank: precedence }).range(from, to));
  }
  // Outer ranges are compiled once per source/tree/mode, never per caret movement.
  for (const range of dirty) syntaxTree(state).iterate({ ...range, enter(reference) {
    work.visitedNodes++;
    if (!touchesSourceRanges(reference, [range])) return false;
    const identity = `${reference.name}:${reference.from}:${reference.to}`;
    if (seen.has(identity)) return;
    seen.add(identity);
    const node = reference.node, from = state.doc.lineAt(node.from).from, to = node.to;
    if (/^(?:ATXHeading[1-6]|SetextHeading[12])$/u.test(node.name)) {
      if (bareMarker(state, node, "HeaderMark") && node.name.startsWith("ATX")) return false;
      wrap(from, to, { "data-qk-prose": `h${node.name.slice(-1)}`, role: "heading", "aria-level": node.name.slice(-1) });
    } else if (node.name === "Paragraph") {
      wrap(from, to, { "data-qk-prose": "p" });
    } else if (["DefinitionList", "DefinitionTerm", "DefinitionDescription"].includes(node.name)) {
      const tag = node.name === "DefinitionList" ? "dl" : node.name === "DefinitionTerm" ? "dt" : "dd";
      wrap(from, to, {}, tag, tag === "dl" ? 10 : 20);
    } else if (node.name === "FootnoteDefinition") {
      wrap(from, to, { "data-qk-prose": "p", role: "note" }, "div", 10);
    } else if (node.name === "Frontmatter") {
      wrap(from, to, { "data-qk-prose": "pre" }); return false;
    } else if (node.name === "Blockquote") {
      wrap(from, to, {}, "blockquote", 10);
    } else if (node.name === "BulletList" || node.name === "OrderedList") {
      if (node.getChildren("ListItem").every(item => bareListItem(state, item))) return false;
      const start = /^\s*(\d+)/u.exec(state.sliceDoc(node.from, Math.min(node.to, node.from + 20)))?.[1];
      wrap(from, to, node.name === "OrderedList" && start ? { start } : {}, node.name === "BulletList" ? "ul" : "ol", 20);
    } else if (node.name === "ListItem") {
      if (bareListItem(state, node)) return false;
      const task = node.getChild("Task");
      wrap(from, to, task ? { class: "md-task-item" } : {}, "li", 30);
    } else if (node.name === "CustomContainer") {
      const marks = node.getChildren("ContainerMark"), name = node.getChild("ContainerName");
      if (marks.length !== 2 || !name) return false;
      const kind = state.sliceDoc(name.from, name.to), header = state.doc.lineAt(node.from), title = node.getChild("ContainerTitle");
      const end = state.doc.lineAt(marks[1]!.from).from;
      wrap(from, to, { class: `qk-prose-container msfe-callout-${kind}`, "data-tone": containerTone(kind), "data-container": kind,
        ...highlightAttributes(kind, title ? state.sliceDoc(title.from, title.to) : "") }, "section", 10);
      wrap(from, header.to, { class: "qk-prose-container__header" }, "div", 60);
      wrap(header.to + 1, end - 1, { class: "qk-prose-container__body" }, "div", 15, true);
    } else if (node.name === "FencedCode") {
      const marks = node.getChildren("CodeMark");
      if (marks.length !== 2) return false;
      const header = state.doc.lineAt(node.from), end = state.doc.lineAt(marks[1]!.from).from;
      wrap(from, to, { class: "qk-code-block qk-prose-source", "data-variant": "soft", "data-qk-not-prose": "" }, "div", 10);
      // A single empty body row still gets the body frame, so typing its first character does not shift it.
      wrap(header.to + 1, end - 1, { class: "qk-code-block__viewport" }, "div", 20, true);
      return false;
    } else if (node.name === "CodeBlock") {
      wrap(from, to, { "data-qk-prose": "pre" }); return false;
    } else if (node.name === "Table") {
      wrap(from, to, { "data-qk-prose": "table", [TABLE_SCROLL_ATTRIBUTE]: "" }); return false;
    }
  } });
  work.wrappers += ranges.length;
  return ranges;
}
