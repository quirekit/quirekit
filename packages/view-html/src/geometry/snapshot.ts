import {
  createQuireLayoutInteractionQueryIndex,
  createQuireLayoutSnapshotViewGraph,
  resolveQuireDocumentProfile,
  quireViewGraphRequiredInvalidationScopeKinds,
  quireViewGraphRequiredPerformanceInvariants,
  type QuireLayoutNode,
  type QuireRetainedLayoutSnapshot
} from "@quirekit/view-engine";
import type { HtmlDescriptor } from "../descriptors";
import type { HtmlFlowGeometryOptions } from "./types";
import { createHtmlSelectionStructureIndex } from "./structure-index";
import { refitHtmlFlowQueryIndex } from "./retained/query-index";

let nextGeometryVersion = 1;

/**
 * Publishes DOM block geometry for shared semantic consumers without running a layout provider.
 * @param options - Retained DOM, canonical state, and surface bounds.
 * @returns Continuous document snapshot with no page products.
 */
export function measureHtmlFlowSnapshot(options: HtmlFlowGeometryOptions): QuireRetainedLayoutSnapshot {
  const { editor, documentView, surfaceState } = options;
  const origin = options.surface.getBoundingClientRect();
  const range = { from: 0, to: editor.state.doc.content.size };
  const capabilities = {
    editable: true, selectable: true, focusable: true,
    copyable: true, commandable: true, accessible: true
  };
  const rootId = { value: `${documentView.root.id.replace(/:document$/, "")}:document-root` };
  const region = {
    rootId,
    regionId: { value: `${documentView.root.id.replace(/:document$/, "")}:document-body` },
    kind: "body" as const
  };
  // The body is selectable and copyable, so its source carries the document range consumers export from.
  const owner = { region, source: { ...documentView.root.source, range }, capabilities };

  /**
   * Retains semantic block boxes; text shaping and line breaking remain browser-owned.
   * @param descriptor - Current descriptor whose represented block descendants are read.
   * @returns Source-ordered DOM block boxes.
   */
  function blocks(descriptor: HtmlDescriptor): QuireLayoutNode[] {
    const children = "children" in descriptor ? descriptor.children.flatMap(blocks) : [];
    if ((descriptor.kind !== "node" && descriptor.kind !== "node-view") || !descriptor.node.isBlock) {
      return children;
    }
    const dom = descriptor.mount?.dom;
    if (!dom || !("getBoundingClientRect" in dom)) return children;
    const rect = (dom as Element).getBoundingClientRect();
    options.onBlockRead?.();
    return [{
      id: descriptor.id,
      kind: "block",
      range: descriptor.range,
      rect: { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height },
      layoutOwner: { ...owner, source: descriptor.source },
      children
    }];
  }

  // Only the continuous body owns a region. Child boxes carry exact DOM/source
  // identity without fabricating page occurrences or fragment-local positions.
  const root: QuireLayoutNode = {
    id: documentView.root.id,
    kind: "block",
    range,
    rect: surfaceState.surfaceBounds,
    viewRoot: { id: rootId, kind: "body", source: { ...owner.source, range }, capabilities },
    viewRegion: region,
    viewCapabilities: capabilities,
    layoutOwner: owner,
    children: options.retainedBlocks ?? blocks(documentView.root)
  };
  const snapshot = {
    state: editor.state,
    documentProfile: resolveQuireDocumentProfile(editor.extensionManager),
    root,
    documentRect: surfaceState.surfaceBounds,
    viewportRect: surfaceState.viewportRect,
    domOverlays: [],
    hitTargets: [],
    interactionQueryIndex: options.retainedBlocks && options.previousSnapshot?.interactionQueryIndex
      ? refitHtmlFlowQueryIndex(options.previousSnapshot.interactionQueryIndex, options.retainedBlocks, surfaceState.viewportRect)
      : createQuireLayoutInteractionQueryIndex({ root, viewportRect: surfaceState.viewportRect }),
    selectionStructureIndex: createHtmlSelectionStructureIndex({ doc: editor.state.doc, extensionManager: editor.extensionManager })
  };
  const graph = createQuireLayoutSnapshotViewGraph({
    // Only the body declares a view root/region. Native block boxes carry no
    // additional region declarations, so graph compilation need not visit them.
    snapshot: { ...snapshot, root: { ...root, children: [] } },
    regionProducts: { roots: [], regions: [], hitTargets: [], layerContributions: [], selectionPolicies: [], gaps: [] },
    version: nextGeometryVersion++,
    performance: {
      invariants: quireViewGraphRequiredPerformanceInvariants,
      invalidationScopes: quireViewGraphRequiredInvalidationScopeKinds.map(kind => ({ kind })),
      queryBudget: { kind: "scan-bounded", maxScannedItems: 1, label: "single continuous DOM body" }
    }
  });
  if (graph.graph === null) throw new RangeError(`Invalid HTML geometry ownership: ${graph.gaps.map(gap => gap.message).join(", ")}`);
  return { ...snapshot, viewGraph: graph.graph, consumerCompilation: graph.consumerCompilation };
}
