import { walkHtmlDescriptors } from "./ownership/descriptor-tree";
import {
  reconcileHtmlContainer
} from "./runtime/children";
import type { HtmlReconcileContext } from "./runtime/types";
import { normalizeHtmlDirtyContainers } from "./runtime/dirty";
import { mapHtmlDescriptorTree } from "./map";
import { createHtmlDomPatchHost } from "./patch";
import { resolveHtmlContainerTarget } from "./matching/targets";
import type {
  HtmlReconcileResult,
  MutableHtmlReconcileTrace,
  ReconcileHtmlDescriptorTreeOptions
} from "./types";
import {
  applyHtmlDescriptorDecorationAttributes,
  clearHtmlDescriptorDecorationAttributes
} from "../node-view/attributes";

/**
 * Reconciles a retained descriptor tree through one transaction mapping.
 *
 * @param options - Existing root, next document, mapping, and changed ranges.
 * @returns Same root plus exact dirty scopes, diagnostics, and DOM writes.
 */
export function reconcileHtmlDescriptorTree(
  options: ReconcileHtmlDescriptorTreeOptions
): HtmlReconcileResult {
  const trace = createTrace();
  const rootDOMBefore = options.root.mount?.dom ?? null;

  clearHtmlDescriptorDecorationAttributes(options.root, trace);
  const mapped = mapHtmlDescriptorTree({
    root: options.root,
    mapping: options.mapping,
    documentSize: options.documentNode.content.size,
    changedRanges: options.changedRanges
  });
  const context: HtmlReconcileContext = {
    ownershipChanged: false,
    ownerDocument: options.ownerDocument,
    allocateId: options.allocateId,
    patchHost: createHtmlDomPatchHost(trace),
    trace,
    diagnostics: [],
    resolveSource: options.resolveSource,
    nodeViewEnvironment: options.nodeViewEnvironment,
    decorationsChanged: options.decorationsChanged === true
  };

  // The document descriptor is immortal. Only its canonical node and content
  // range advance before independently reconciling the smallest dirty parents.
  options.root.updateNode(options.documentNode, {
    from: 0,
    to: options.documentNode.content.size
  });
  const mappedDirtyContainers = normalizeHtmlDirtyContainers(
    mapped.dirtyContainers,
    options.documentNode
  );
  const dirtyContainers = options.decorationsChanged
    ? [options.root]
    : mappedDirtyContainers;

  for (const container of dirtyContainers) {
    const target = resolveHtmlContainerTarget(container, options.documentNode);

    if (target) {
      reconcileHtmlContainer(container, target, context);
    }
  }
  walkHtmlDescriptors(options.root, descriptor => {
    if (!descriptor.destroyed) descriptor.setDirtyState("clean");
  });
  applyHtmlDescriptorDecorationAttributes(
    options.root,
    options.nodeViewEnvironment,
    trace
  );
  trace.rootReplacements = rootDOMBefore === (options.root.mount?.dom ?? null) ? 0 : 1;

  return {
    root: options.root,
    ownershipChanged: context.ownershipChanged,
    dirtyContainers: dirtyContainers.map((descriptor) => descriptor.id),
    diagnostics: context.diagnostics,
    trace
  };
}

/**
 * Creates the mutable exact-write trace for one pass.
 *
 * @returns Empty trace whose root identity count is finalized after reconciliation.
 */
function createTrace(): MutableHtmlReconcileTrace {
  return {
    descriptorVisits: 0,
    nodeViewUpdateAttempts: 0,
    decorationWrites: 0,
    textWrites: [],
    textWriteDetails: [],
    attributeWrites: [],
    structureWrites: [],
    rootReplacements: 0
  };
}
