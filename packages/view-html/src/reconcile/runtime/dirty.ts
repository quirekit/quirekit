import type { Node as ProseMirrorNode } from "@quirekit/pm";
import type { HtmlContainerDesc } from "../../descriptors";
import { resolveHtmlContainerTarget } from "../matching/targets";

/**
 * Escalates dirty scopes whose mapped product spans a split/join or lost mark.
 *
 * @param containers - Initially selected smallest dirty containers.
 * @param documentNode - Next canonical document.
 * @returns Resolvable parent-bounded dirty scopes in document order.
 */
export function normalizeHtmlDirtyContainers(
  containers: readonly HtmlContainerDesc[],
  documentNode: ProseMirrorNode
): HtmlContainerDesc[] {
  const normalized = new Set<HtmlContainerDesc>();

  for (const initial of containers) {
    let container = initial;
    let target = resolveHtmlContainerTarget(container, documentNode);

    while (
      container.parent &&
      (container.kind === "node-view" || !target || (
        container.kind === "node" &&
        target.node.nodeSize !== container.range.to - container.range.from
      ))
    ) {
      container = container.parent;
      target = resolveHtmlContainerTarget(container, documentNode);
    }
    normalized.add(container);
  }
  return [...normalized].filter((candidate) => (
    ![...normalized].some((other) => (
      other !== candidate && isAncestor(other, candidate)
    ))
  )).sort((left, right) => left.range.from - right.range.from);
}

/**
 * Checks retained container ancestry without inspecting DOM structure.
 *
 * @param ancestor - Possible ancestor dirty scope.
 * @param descendant - Possible retained descendant scope.
 * @returns Whether the descendant is owned below the ancestor.
 */
function isAncestor(ancestor: HtmlContainerDesc, descendant: HtmlContainerDesc): boolean {
  for (let parent = descendant.parent; parent; parent = parent.parent) {
    if (parent === ancestor) {
      return true;
    }
  }
  return false;
}
