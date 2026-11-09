import { Fragment, Slice, type Node } from "@quirekit/pm";
import { v4 as uuidv4 } from "uuid";
import { readWhiteboardNode } from "./source";

/** @param slice - Source-preserving clipboard fragment. @returns The fragment with each pasted board under a fresh identity. */
export function forkWhiteboardSlice(slice: Slice): Slice {
  /** @param node - Clipboard node. @returns A detached copy where a board is encountered. */
  function copy(node: Node): Node {
    if (node.type.name === "whiteboard") {
      const board = readWhiteboardNode(node);
      return board ? node.type.create({ ...node.attrs, board: { ...board, id: uuidv4() } }, null, node.marks) : node;
    }
    if (node.isLeaf) return node;
    const children: Node[] = []; node.content.forEach(child => children.push(copy(child)));
    return node.copy(Fragment.fromArray(children));
  }
  const nodes: Node[] = []; slice.content.forEach(node => nodes.push(copy(node)));
  return new Slice(Fragment.fromArray(nodes), slice.openStart, slice.openEnd);
}
