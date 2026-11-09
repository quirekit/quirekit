import type { Node } from '@quirekit/pm';

/**
 * Finds literal Tab text only, without treating cached atom content as ordinary runs.
 * @param node - Immutable paragraph or inline subtree.
 * @returns Whether the authored text descendants contain a Tab.
 */
export function containsParagraphTab(node: Node): boolean {
  if (node.isText) return node.text?.includes('\t') === true;
  if (node.isAtom) return false;
  for (let index = 0; index < node.childCount; index += 1) {
    if (containsParagraphTab(node.child(index))) return true;
  }
  return false;
}
