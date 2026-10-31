import type { Mapping, Node } from "@quirekit/pm";

/**
 * Finds a block again after a container holding it was replaced as a whole, such as a
 * table rewritten by one step to change a cell's fill.
 *
 * Walks up from the block to the first ancestor whose boundaries still map onto a node of
 * the same type. That ancestor counts as replaced only when its inside did not survive the
 * mapping; the block is then found by the same child indices, and only when the old and new
 * ancestor have the same shape, so a row added or removed never moves an id onto another block.
 *
 * @param snapshot - Document the block position refers to.
 * @param doc - Current document.
 * @param mapping - Steps from `snapshot` to `doc`.
 * @param pos - Position before the block in `snapshot`.
 * @param type - Block node name.
 * @returns Current position, or null when the block is gone or its container changed shape.
 */
export function locateInReplacedContainer(snapshot: Node, doc: Node, mapping: Mapping, pos: number, type: string): number | null {
  if (pos > snapshot.content.size) return null;
  const $pos = snapshot.resolve(pos);
  for (let depth = $pos.depth; depth >= 1; depth -= 1) {
    const ancestor = $pos.node(depth);
    const start = $pos.before(depth);
    const from = mapping.map(start, -1);
    const replaced = doc.nodeAt(from);
    if (replaced?.type !== ancestor.type || from + replaced.nodeSize !== mapping.map(start + ancestor.nodeSize, 1)) continue;
    // An ancestor whose inside survived was not replaced: the block itself is gone.
    if (!mapping.mapResult(start + 1, 1).deleted || !sameShape(ancestor, replaced)) return null;
    let node = replaced;
    let at = from;
    for (let level = depth; level <= $pos.depth; level += 1) {
      const index = $pos.index(level);
      let offset = 0;
      for (let child = 0; child < index; child += 1) offset += node.child(child).nodeSize;
      at += 1 + offset;
      node = node.child(index);
    }
    return node.type.name === type ? at : null;
  }
  return null;
}

/**
 * @param left - Old node.
 * @param right - New node.
 * @returns Whether both have the same node types and child counts down to their text blocks.
 */
function sameShape(left: Node, right: Node): boolean {
  if (left.type !== right.type) return false;
  if (left.isTextblock || left.isLeaf) return true;
  if (left.childCount !== right.childCount) return false;
  for (let index = 0; index < left.childCount; index += 1) {
    if (!sameShape(left.child(index), right.child(index))) return false;
  }
  return true;
}
