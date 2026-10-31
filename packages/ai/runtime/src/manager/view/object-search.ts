import type { Node } from "@quirekit/pm";
import type { QuireAiRegistry } from "../types";
import type { QuireAiViewBlock } from "./types";

/**
 * Tells whether the objects of a block mention text the model searches for: the label of a block
 * that is not a text block, or the labels of the inline objects a text block holds, such as a
 * diagram stored as a picture. Text the model could replace is matched by the text search instead.
 *
 * @param block - Listed block.
 * @param doc - Document root, which some labels number against.
 * @param registry - Compiled facts.
 * @param find - Normalized searched text.
 * @returns Whether an object label of the block contains the text.
 */
export function mentionsQuireAiObjectText(block: QuireAiViewBlock, doc: Node, registry: QuireAiRegistry, find: string): boolean {
  /** @param node - Object node. @returns Its view label, empty when it has none. */
  const label = (node: Node) => registry.blocks.get(node.type.name)?.label?.(node, doc) ?? "";
  if (!block.node.isTextblock) return label(block.node).includes(find);
  let found = false;
  block.node.descendants(child => {
    if (!found && child.isLeaf && !child.isText && child.type.name !== "hardBreak") found = label(child).includes(find);
    return !found;
  });
  return found;
}
