import type { QuireViewMutationRecord } from "@quirekit/core";
import type { HtmlDescriptor, HtmlDocumentDesc } from "../../descriptors";
import { walkHtmlDescriptors } from "../../reconcile/ownership/descriptor-tree";

/**
 * Indexes exact mounts and content holes for a retained topology.
 * @param root - Current retained document root.
 * @returns Direct DOM ownership, with ancestor lookup supplied separately.
 */
export function indexHtmlMutationOwners(root: HtmlDocumentDesc): WeakMap<Node, HtmlDescriptor> {
  const owners = new WeakMap<Node, HtmlDescriptor>();
  walkHtmlDescriptors(root, descriptor => {
    if (descriptor.mount) {
      owners.set(descriptor.mount.dom, descriptor);
      if (descriptor.mount.contentDOM) owners.set(descriptor.mount.contentDOM, descriptor);
    }
  });
  return owners;
}

/**
 * Resolves the closest custom or schema owner of a mutation.
 * @param target - Observed DOM target.
 * @param owners - Current retained ownership.
 * @returns Nearest retained owner, or undefined outside represented mounts.
 */
export function findHtmlMutationOwner(target: Node, owners: WeakMap<Node, HtmlDescriptor>): HtmlDescriptor | undefined {
  for (let current: Node | null = target; current; current = current.parentNode) {
    const owner = owners.get(current);
    if (owner) return owner;
  }
  return undefined;
}

/**
 * Offers internal mutations to their exact custom-view authority.
 * @param owner - Retained owner of the target.
 * @param record - Observed browser mutation.
 * @returns Whether the owner accepts the internal change.
 */
export function routeHtmlOwnedMutation(owner: HtmlDescriptor, record: QuireViewMutationRecord): boolean {
  // A widget owns its chrome; its parent still owns placement and removal.
  if (owner.kind === "widget") return record.type !== "selection";
  if (owner.kind === "node-view" || owner.kind === "mark") return owner.host?.ignoreMutation(record) === true;
  return false;
}
