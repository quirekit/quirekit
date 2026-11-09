import type { HtmlOwnedNodeSnapshot } from "./types";

/**
 * Captures canonical DOM facts recursively without cloning owned identity.
 * @param node - Root of a newly owned subtree.
 * @param snapshots - Instance-local recovery authority.
 */
export function captureHtmlOwnedSubtree(
  node: Node,
  snapshots: WeakMap<Node, HtmlOwnedNodeSnapshot>
): void {
  const snapshot = captureHtmlOwnedNode(node, snapshots);
  for (const child of snapshot.children) {
    captureHtmlOwnedSubtree(child, snapshots);
  }
}

/**
 * Refreshes only observed targets and genuinely added DOM subtrees.
 * @param records - Records drained immediately after authorized writes.
 * @param snapshots - Existing canonical facts retained for unchanged nodes.
 */
export function captureHtmlOwnedChanges(
  records: readonly MutationRecord[],
  snapshots: WeakMap<Node, HtmlOwnedNodeSnapshot>
): void {
  const targets = new Set<Node>();
  const added = new Set<Node>();
  for (const record of records) {
    targets.add(record.target);
    if (record.type === "childList") {
      for (const node of Array.from(record.addedNodes)) {
        added.add(node);
      }
    }
  }
  for (const target of targets) {
    captureHtmlOwnedNode(target, snapshots);
  }
  // Capture children only after their final placement, including moved subtrees.
  for (const node of added) {
    captureHtmlOwnedSubtree(node, snapshots);
  }
}

/**
 * Captures one node's value, attributes and direct children.
 * @param node - Target with completed authorized writes.
 * @param snapshots - Instance-local recovery authority.
 * @returns Captured facts, also used to traverse newly owned subtrees.
 */
function captureHtmlOwnedNode(
  node: Node,
  snapshots: WeakMap<Node, HtmlOwnedNodeSnapshot>
): HtmlOwnedNodeSnapshot {
  const snapshot = {
    nodeValue: node.nodeValue,
    attributes: readHtmlAttributes(node),
    children: Array.from(node.childNodes)
  };
  snapshots.set(node, snapshot);
  return snapshot;
}

/**
 * Restores one smallest mutated DOM scope from its canonical snapshot.
 * @param node - Unauthorized mutation target.
 * @param snapshots - Canonical facts accepted before the mutation.
 */
export function restoreHtmlOwnedNode(
  node: Node,
  snapshots: WeakMap<Node, HtmlOwnedNodeSnapshot>
): void {
  const snapshot = snapshots.get(node);
  if (!snapshot) {
    return;
  }
  if (node.nodeType === 3) {
    node.nodeValue = snapshot.nodeValue;
    return;
  }
  if (node.nodeType === 1) {
    const element = node as Element;
    for (const name of element.getAttributeNames()) {
      if (!snapshot.attributes.has(name)) {
        element.removeAttribute(name);
      }
    }
    for (const [name, value] of snapshot.attributes) {
      element.setAttribute(name, value);
    }
  }
  if (!sameHtmlChildren(node.childNodes, snapshot.children)) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
    for (const child of snapshot.children) {
      node.appendChild(child);
    }
  }
}

/**
 * Reads the exact attribute authority for a snapshot target.
 * @param node - Canonical DOM owner.
 * @returns Exact element attributes, or an empty map for text.
 */
function readHtmlAttributes(node: Node): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  if (node.nodeType === 1) {
    const element = node as Element;
    for (const name of element.getAttributeNames()) {
      attributes.set(name, element.getAttribute(name) ?? "");
    }
  }
  return attributes;
}

/**
 * Checks direct child identity before restoring a mutated parent.
 * @param actual - Current direct children.
 * @param expected - Canonical direct children.
 * @returns Whether identity and order agree.
 */
function sameHtmlChildren(
  actual: NodeListOf<ChildNode> | readonly Node[],
  expected: readonly Node[]
): boolean {
  return actual.length === expected.length &&
    expected.every((child, index) => actual[index] === child);
}
