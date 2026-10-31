import { Fragment, type Node, type ResolvedPos } from "@quirekit/pm";
import type { QuireAiRegistry } from "../types";
import type { QuireAiInlineSpan } from "./markup";
import { createQuireAiInlineContent } from "./text";
import type { QuireAiDeletionRange, QuireAiEditRange, QuireAiFormatValue, QuireAiNestedSpans, QuireAiPlannedBlock, QuireAiPlannedOperation } from "./types";

type FormattedSpan = QuireAiInlineSpan & QuireAiFormatValue;

/** A resolved block with the facts deletion needs about its parent. */
export interface PlanBlock {
  /** Block id. */
  readonly id: string;
  /** Position before the block. */
  readonly pos: number;
  /** Block node. */
  readonly node: Node;
  /** Content start of the parent node. */
  readonly parentStart: number;
  /** Number of children of the parent node. */
  readonly parentChildCount: number;
}

/**
 * Finds the wrapper a block sits in when that wrapper can itself be removed as a block, such as a
 * block content control; table cells, sections and stories cannot.
 * @param $pos - Resolved position before the block.
 * @param registry - Compiled facts, naming the structure nodes.
 * @returns Position before the wrapper and its size, or null.
 */
export function findRemovableQuireAiParent($pos: ResolvedPos, registry: QuireAiRegistry): { readonly pos: number; readonly size: number } | null {
  const parent = $pos.parent;
  if ($pos.depth < 2 || parent.isTextblock || parent.type.spec.tableRole !== undefined || registry.structures.has(parent.type.name)) return null;
  // Removing the wrapper must leave its own parent with content.
  if ($pos.node($pos.depth - 1).childCount < 2) return null;
  return { pos: $pos.before(), size: parent.nodeSize };
}

/**
 * Finds the body part a block sits in, such as a section, when deleting all of its content may remove
 * it: another part of its kind remains, so the body keeps content.
 * @param $pos - Resolved position before the block.
 * @param registry - Compiled facts, naming the body structure nodes.
 * @returns Position before the body part and its size, or null.
 */
export function findRemovableQuireAiBodyPart($pos: ResolvedPos, registry: QuireAiRegistry): { readonly pos: number; readonly size: number } | null {
  const parent = $pos.parent;
  if ($pos.depth < 1 || registry.structures.get(parent.type.name)?.role !== "body") return null;
  let parts = 0;
  $pos.node($pos.depth - 1).forEach(child => { if (child.type === parent.type) parts += 1; });
  return parts > 1 ? { pos: $pos.before(), size: parent.nodeSize } : null;
}

/**
 * Creates a paragraph block for insertion.
 * @param source - Document or neighbouring block whose schema supplies the paragraph type.
 * @param text - Paragraph text.
 * @param paragraph - Paragraph formats.
 * @param spans - Character formats relative to the text.
 * @param template - Neighbouring text block whose type is reused; its attributes are not copied.
 * @returns Planned paragraph.
 */
export function createParagraph(
  source: Node,
  text: string,
  paragraph: readonly QuireAiFormatValue[],
  spans: readonly FormattedSpan[],
  template?: Node
): QuireAiPlannedBlock {
  const schema = source.type.schema;
  const type = template?.isTextblock ? template.type : schema.nodes.paragraph ?? schema.topNodeType.contentMatch.defaultType!;
  return { node: type.create(null, text.length > 0 ? createQuireAiInlineContent(schema, text) : null), paragraph, spans };
}

/**
 * Plans block removal, keeping one cleared block where a container would become empty.
 * @param blocks - Blocks to remove.
 * @param fail - Rejects the operation.
 * @param doc - Document, to remove wrappers whose every text block is removed.
 * @param registry - Compiled facts, naming the structure nodes wrappers never are.
 * @returns Ranges in start-document positions.
 */
export function planDeletion(
  blocks: readonly PlanBlock[],
  fail: (message: string) => never,
  doc?: Node,
  registry?: QuireAiRegistry
): readonly QuireAiDeletionRange[] {
  const ranges: QuireAiDeletionRange[] = [];
  // A block inside another deleted block goes with it.
  let remaining = blocks.filter(entry => !blocks.some(other => other !== entry && entry.pos > other.pos && entry.pos < other.pos + other.node.nodeSize));
  // Removing every text block of a wrapper such as a block content control, or of a section when another
  // section remains, removes the outermost such wrapper instead of leaving it behind empty.
  if (doc !== undefined && registry !== undefined) {
    const deleted = new Set(remaining.map(entry => entry.pos));
    const covered = (from: number, size: number) => {
      let all = true;
      doc.nodesBetween(from + 1, from + size - 1, (node, pos) => {
        if (!all) return false;
        if (deleted.has(pos)) return false;
        if (node.isTextblock) { all = false; return false; }
        return true;
      });
      return all;
    };
    const wrappers = new Map<number, number>();
    for (const entry of remaining) {
      let $pos = doc.resolve(entry.pos);
      let outer: { pos: number; size: number } | null = null;
      const removable = (at: typeof $pos) => findRemovableQuireAiParent(at, registry) ?? findRemovableQuireAiBodyPart(at, registry);
      for (let wrapper = removable($pos); wrapper !== null && covered(wrapper.pos, wrapper.size); wrapper = removable($pos)) {
        outer = wrapper;
        $pos = doc.resolve(wrapper.pos);
      }
      if (outer !== null) wrappers.set(outer.pos, outer.size);
    }
    for (const [pos, size] of wrappers) ranges.push({ from: pos, to: pos + size, clear: false });
    remaining = remaining.filter(entry => ![...wrappers].some(([pos, size]) => entry.pos > pos && entry.pos < pos + size));
  }
  const byParent = new Map<number, Map<number, PlanBlock>>();
  for (const entry of remaining) {
    const siblings = byParent.get(entry.parentStart) ?? new Map<number, PlanBlock>();
    siblings.set(entry.pos, entry);
    byParent.set(entry.parentStart, siblings);
  }
  for (const siblings of byParent.values()) {
    const sorted = [...siblings.values()].sort((left, right) => left.pos - right.pos);
    sorted.forEach((entry, index) => {
      const keep = index === 0 && sorted.length === entry.parentChildCount;
      if (keep && !entry.node.isTextblock) fail(`block ${entry.id} is the last block of its container; replace its content instead.`);
      const last = sorted.at(-1)!;
      ranges.push({
        from: entry.pos, to: entry.pos + entry.node.nodeSize, clear: keep,
        ...(keep ? { container: { from: entry.parentStart, to: last.pos + last.node.nodeSize } } : {})
      });
    });
  }
  return ranges;
}

/**
 * Groups sibling blocks that follow each other directly into content ranges.
 * @param blocks - Blocks sorted by position.
 * @returns One range per run of adjacent blocks.
 */
export function groupContiguous(blocks: readonly { pos: number; node: Node }[]): readonly QuireAiEditRange[] {
  const runs: { from: number; to: number; end: number }[] = [];
  for (const { pos, node } of blocks) {
    const last = runs.at(-1);
    if (last !== undefined && last.end === pos) { last.to = pos + node.nodeSize - 1; last.end = pos + node.nodeSize; }
    else runs.push({ from: pos + 1, to: pos + node.nodeSize - 1, end: pos + node.nodeSize });
  }
  return runs.map(({ from, to }) => ({ from, to }));
}

/**
 * Removes instead of clears a container's last block when the same edit inserts into it.
 *
 * Replacing a whole body is "delete every block, insert the new ones": clearing the
 * last old block would leave a stray empty paragraph. Such deletes run after every
 * other operation, so the container is never empty; positions are mapped through
 * the transaction, so the moved delete still targets the old blocks only.
 *
 * @param operations - Planned operations in model order.
 * @returns Operations with refilled containers settled.
 */
export function settleRefilledContainers(operations: readonly QuireAiPlannedOperation[]): readonly QuireAiPlannedOperation[] {
  const inserts = operations.flatMap(operation => operation.kind === "insert" ? [operation.at] : []);
  const refilled = (range: QuireAiDeletionRange) => range.clear && range.container !== undefined
    && inserts.some(at => at >= range.container!.from && at <= range.container!.to);
  const moved: QuireAiPlannedOperation[] = [];
  const kept = operations.filter(operation => {
    if (operation.kind !== "delete" || !operation.ranges.some(refilled)) return true;
    moved.push({ ...operation, ranges: operation.ranges.map(range => refilled(range) ? { ...range, clear: false } : range) });
    return false;
  });
  return [...kept, ...moved];
}

/**
 * Turns inline markup in the text blocks of a created block, such as a table built from cell
 * texts, into plain text plus the character formats to apply once the block is inserted.
 * @param node - Created block.
 * @param parse - Parses one text into plain text and its formats.
 * @returns The block with plain text, and the formats of each text block that had markup.
 */
export function liftQuireAiNestedMarkup(
  node: Node,
  parse: (text: string) => { readonly text: string; readonly spans: readonly (QuireAiInlineSpan & QuireAiFormatValue)[] }
): { readonly node: Node; readonly nested: readonly QuireAiNestedSpans[] } {
  const marked = new Map<Node, readonly (QuireAiInlineSpan & QuireAiFormatValue)[]>();
  /** @param current - Node to rebuild. @returns The node with plain text in its text blocks. */
  const rebuild = (current: Node): Node => {
    if (current.isTextblock) {
      // Only plain-text blocks carry markup; blocks with other inline content are left as built.
      let plain = true;
      current.forEach(child => { if (!child.isText) plain = false; });
      const parsed = plain ? parse(current.textContent) : null;
      if (parsed === null || (parsed.spans.length === 0 && parsed.text === current.textContent)) return current;
      const rebuilt = current.type.create(current.attrs, parsed.text.length > 0 ? createQuireAiInlineContent(current.type.schema, parsed.text) : null, current.marks);
      if (parsed.spans.length > 0) marked.set(rebuilt, parsed.spans);
      return rebuilt;
    }
    if (current.isLeaf || current.childCount === 0) return current;
    const children: Node[] = [];
    current.forEach(child => children.push(rebuild(child)));
    return children.every((child, index) => child === current.child(index)) ? current : current.copy(Fragment.from(children));
  };
  const result = rebuild(node);
  const nested: QuireAiNestedSpans[] = [];
  if (marked.size > 0) {
    result.descendants((child, pos) => {
      const spans = marked.get(child);
      if (spans !== undefined) nested.push({ offset: pos + 2, spans });
      return !child.isTextblock;
    });
  }
  return { node: result, nested };
}
