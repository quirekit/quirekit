import type { ChangeSet, EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import type { QualityViolation } from "./types";

/** Block-level nodes whose identity a remote edit must not change. */
const blockNodes = new Set(["Paragraph", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6",
  "SetextHeading1", "SetextHeading2", "BulletList", "OrderedList", "ListItem", "Blockquote", "FencedCode", "CodeBlock", "Table",
  "HorizontalRule", "CustomContainer", "Frontmatter", "HTMLBlock", "DisplayMath"]);

/** One parsed block-level node. */
interface BlockNode {
  /** Node type with its block ancestors, so a change of nesting is a change of identity. */ readonly name: string;
  /** Source start. */ readonly from: number;
  /** Source end. */ readonly to: number;
}

/** @param state - Source to parse completely. @returns Every block-level node in document order. */
export function blockNodesOf(state: EditorState): readonly BlockNode[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  const nodes: BlockNode[] = [];
  const path: string[] = [];
  tree?.iterate({
    enter: node => {
      if (!blockNodes.has(node.name)) return;
      path.push(node.name);
      // A nested list starts at its parent's content column, which moves with the nesting depth.
      const from = node.from + /^[ \t]*/u.exec(state.sliceDoc(node.from, node.to))![0].length;
      nodes.push({ name: path.join(">"), from, to: node.to });
    },
    leave: node => { if (blockNodes.has(node.name)) path.pop(); },
  });
  return nodes;
}

/** Containers legitimately grow or shrink when an item or line next to their end changes. */
const containerNodes = new Set(["BulletList", "OrderedList", "ListItem", "Blockquote", "Table"]);

/**
 * I1: every block the edit does not touch (overlap or adjacency) survives. Leaf blocks keep their type
 * and exact source; containers keep their type and start, since content added at their end extends them.
 * @param before - Source before the edit. @param after - Source after it. @param changes - The edit.
 * @param owner - Position whose enclosing blocks may extend, such as the caret that just typed.
 * @param moved - Source ranges of list items an edit moves as a whole: the caret's item, which indenting and
 * outdenting move, and items whose own text the edit changes; their children may change nesting depth.
 * @returns One violation per block whose parse changed elsewhere.
 */
export function preservedBlocks(before: EditorState, after: EditorState, changes: ChangeSet, owner?: number, moved: readonly { from: number; to: number }[] = []): readonly QualityViolation[] {
  const nodes = blockNodesOf(after), leaf = (name: string) => name.split(">").at(-1)!;
  const exact = new Set(nodes.flatMap(node => [`${node.name}@${node.from}-${node.to}`, `~${leaf(node.name)}@${node.from}-${node.to}`]));
  const starts = new Set(nodes.flatMap(node => [`${node.name}@${node.from}`, `~${leaf(node.name)}@${node.from}`]));
  const owning = new Set(nodes.filter(node => owner !== undefined && node.from <= owner && owner <= node.to).map(node => `${node.name}@${node.from}`));
  return blockNodesOf(before).filter(node => !changes.touchesRange(node.from, node.to)).flatMap(node => {
    const from = changes.mapPos(node.from), to = changes.mapPos(node.to);
    // Blocks inside the moved item keep their type and text but may change nesting depth.
    const name = moved.some(range => range.from <= node.from && node.to <= range.to) ? `~${leaf(node.name)}` : node.name, start = `${name}@${from}`;
    const same = containerNodes.has(leaf(node.name)) || owning.has(start) ? starts.has(start)
      : exact.has(`${name}@${from}-${to}`) && after.sliceDoc(from, to) === before.sliceDoc(node.from, node.to);
    return same ? [] : [{ rule: "I1" as const, detail: `${node.name.split(">").at(-1)} ${JSON.stringify(before.sliceDoc(node.from, node.to))} 不再原样存在` }];
  });
}

/**
 * I2: structural keys never create an indented code block the user did not type.
 * @param before - Source before the edit. @param after - Source after it. @param changes - The edit.
 * @returns A violation for each new indented code block.
 */
export function accidentalCode(before: EditorState, after: EditorState, changes: ChangeSet): readonly QualityViolation[] {
  const existing = new Set(blockNodesOf(before).filter(node => node.name.endsWith("CodeBlock")).map(node => changes.mapPos(node.from)));
  return blockNodesOf(after).filter(node => node.name.endsWith("CodeBlock") && !node.name.endsWith("FencedCode") && !existing.has(node.from))
    .map(node => ({ rule: "I2" as const, detail: `产生了缩进代码块 ${JSON.stringify(after.sliceDoc(node.from, node.to))}` }));
}
