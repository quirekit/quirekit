import type { HtmlDescriptor, HtmlDocumentDesc, HtmlTextDesc } from "../../descriptors";
import { walkHtmlDescriptors } from "./descriptor-tree";
import type { HtmlPositionIndexState } from "./types";

/**
 * Builds lookup tables only when retained topology needs fresh authority.
 * @param root - Mounted descriptor root, or undefined when releasing an index.
 * @returns Cohesive ownership tables referencing current mutable descriptor ranges.
 */
export function createHtmlPositionIndexState(root?: HtmlDocumentDesc): HtmlPositionIndexState {
  const domOwners = new WeakMap<Node, HtmlDescriptor>();
  const descriptors: HtmlDescriptor[] = [];
  const represented = new Set<HtmlDescriptor>();
  const texts: HtmlTextDesc[] = [];
  const unrepresented: HtmlDescriptor[] = [];
  const descriptorsById = new Map<string, HtmlDescriptor>();
  let customOwnership = false;

  if (root) {
    walkHtmlDescriptors(root, descriptor => {
      descriptors.push(descriptor);
      descriptorsById.set(descriptor.id, descriptor);
      if (descriptor.kind === "text") {
        texts.push(descriptor);
      }
      if (descriptor.kind === "node-view" || descriptor.kind === "mark" && descriptor.factory) {
        customOwnership = true;
      }
      const parentRepresented = descriptor.parent === null || represented.has(descriptor.parent);
      const attached = descriptor.parent === null || (
        descriptor.parent.mount?.contentDOM === descriptor.mount?.dom.parentNode
      );
      if (descriptor.mount && parentRepresented && attached) {
        represented.add(descriptor);
        domOwners.set(descriptor.mount.dom, descriptor);
        if (descriptor.mount.contentDOM) {
          domOwners.set(descriptor.mount.contentDOM, descriptor);
        }
      } else if (descriptor.kind !== "document") {
        unrepresented.push(descriptor);
      }
    });
  }
  return {
    domOwners,
    descriptors,
    represented,
    texts,
    unrepresented,
    descriptorsById,
    customOwnership
  };
}
