import type { QuireEditor } from "@quirekit/core";
import type { QuireDisplayCommand } from "@quirekit/renderer";
import { resolveQuireDocumentProfile } from "../document-profile";
import {
  buildQuireDecorationLane,
  createQuireDecorationWidgetDomOverlays
} from "../decorations";
import {
  buildQuireDisplayList,
  createQuireDisplayListLayerCollector,
  resolveDisplayListStyles
} from "../display-list";
import {
  createQuireDisplayInvalidationProjection,
  createQuireRetainedDisplayOwnerChunkCollector,
  createQuireRetainedDisplayOwnerDiagnostics,
  createQuireRetainedDisplayOwnerIndex,
  realizeQuirePageStackDisplayOwnerChunks
} from "../display-ownership";
import {
  buildQuireRenderInteractionSnapshot,
  buildQuireSelectionGeometry,
  createQuireActiveLayerViewTargets,
  createQuireActiveRuntimeLayerDomOverlays,
  createQuireDecorationCursorTargets
} from "../interaction";
import { snapshotQuireViewEngineFrameCacheCounters } from "./counters";
import { buildQuireViewEngineLayoutSnapshot } from "./layout";
import {
  createQuirePresentationOverlayDecorations,
  resolveQuirePresentationFrameOptions
} from "./presentation-overlay";
import {
  createQuireViewEngineDisplayChunkCounters,
  resolveQuireViewEngineImePreeditRange,
  resolveQuireViewEnginePageChunkPages
} from "./pages";
import { resolveQuireFramePositionMapping } from "./positions";
import { traceQuireViewEnginePhase } from "./trace";
import type {
  QuireViewEngineFrame,
  QuireViewEngineFrameBuildOptions,
  QuireViewEngineFrameCacheAuthority
} from "./types";

/**
 * Compiles one complete renderer-neutral editor frame.
 *
 * Phase order is intentional: all geometry derives from one layout state;
 * owner selection precedes command realization; diagnostics sample only after
 * every retained product has been finalized.
 *
 * @param editor - Editor providing source and extension authority.
 * @param requestedOptions - Renderer-neutral frame inputs.
 * @param caches - Runtime-owned accepted or transient cache authority.
 * @returns Complete frame artifacts for mounted or targetless consumers.
 */
export function buildQuireViewEngineFrame(
  editor: QuireEditor,
  requestedOptions: QuireViewEngineFrameBuildOptions,
  caches: QuireViewEngineFrameCacheAuthority
): QuireViewEngineFrame {
  const options = resolveQuirePresentationFrameOptions(editor.state, requestedOptions);
  const trace = options.trace;
  const layoutSnapshot = buildQuireViewEngineLayoutSnapshot(editor, options, caches);
  const selectionGeometry = traceQuireViewEnginePhase(
    trace,
    "render:selection-geometry",
    () => buildQuireSelectionGeometry({
      snapshot: layoutSnapshot,
      ...(options.caretWidth === undefined ? {} : { caretWidth: options.caretWidth }),
      ...(options.selectionContext === undefined
        ? {}
        : { selectionContext: options.selectionContext })
    })
  );
  const displayListStyles = traceQuireViewEnginePhase(
    trace,
    "render:display-list-styles",
    () => {
      const pageFill = resolveQuireDocumentProfile(editor.extensionManager).pageModel.pageFill(layoutSnapshot.state.doc);
      const pageStyle = pageFill === null ? {} : { pageFillStyle: pageFill };
      return resolveDisplayListStyles({ ...options.displayListStyles, ...pageStyle }, options.surfaceConfig);
    }
  );
  const decorationLane = traceQuireViewEnginePhase(
    trace,
    "render:decoration-lane",
    () => buildQuireDecorationLane({
      snapshot: layoutSnapshot,
      invisibleCharacters: options.surfaceConfig?.invisibleCharacters,
      clipRects: options.displayListClipRects,
      view: options.decorationSourceView,
      theme: options.decorationTheme,
      ...(options.decorationScope === undefined
        ? {}
        : { scope: options.decorationScope }),
      frameDecorations: createQuirePresentationOverlayDecorations(
        options,
        layoutSnapshot.state.doc.content.size
      )
    })
  );
  const decorationWidgetDomOverlays = traceQuireViewEnginePhase(
    trace,
    "render:decoration-overlays",
    () => createQuireDecorationWidgetDomOverlays(
      decorationLane.widgets,
      options.decorationSourceView
    )
  );
  const renderTimeDomOverlays = [
    ...createQuireActiveRuntimeLayerDomOverlays(layoutSnapshot),
    ...decorationWidgetDomOverlays
  ];
  const interactionSnapshot = traceQuireViewEnginePhase(
    trace,
    "render:interaction-snapshot",
    () => buildQuireRenderInteractionSnapshot({
      layoutSnapshot,
      selectionGeometry,
      decorationLane,
      domOverlays: renderTimeDomOverlays
    })
  );
  const pageChunkPages = resolveQuireViewEnginePageChunkPages(
    layoutSnapshot,
    options.requirePageDisplayListChunks
  );
  const displayOwnerIndex = traceQuireViewEnginePhase(
    trace,
    "render:display-owner-index",
    () => createQuireRetainedDisplayOwnerIndex({
      snapshot: layoutSnapshot,
      ...(pageChunkPages === undefined ? {} : { realizationPages: pageChunkPages }),
      selectionGeometry,
      decorationLane
    })
  );
  const displayInvalidation = traceQuireViewEnginePhase(
    trace,
    "render:display-invalidation-projection",
    () => createQuireDisplayInvalidationProjection({
      ownerIndex: displayOwnerIndex,
      ...(options.updatePatch === undefined ? {} : { updatePatch: options.updatePatch }),
      ...(options.layoutDirtyRange === undefined
        ? {}
        : { layoutDirtyRange: options.layoutDirtyRange })
    })
  );
  const ownerChunks = createQuireRetainedDisplayOwnerChunkCollector(displayOwnerIndex);
  const retainCompositeLists = options.requirePageDisplayListChunks !== true;
  const layerCollector = retainCompositeLists
    ? createQuireDisplayListLayerCollector()
    : undefined;

  /** @param command - Top-level command emitted by the display compiler. */
  function observeDisplayCommand(command: QuireDisplayCommand): void {
    layerCollector?.observe(command);
  }

  const displayList = traceQuireViewEnginePhase(
    trace,
    "render:display-list",
    () => buildQuireDisplayList({
      snapshot: layoutSnapshot,
      ...(options.activeAuxiliaryStorySourceId === undefined
        ? {}
        : { activeAuxiliaryStorySourceId: options.activeAuxiliaryStorySourceId }),
      selectionGeometry,
      decorationLane,
      ...(resolveQuireViewEngineImePreeditRange(options.imePreedit) === undefined
        ? {}
        : { imePreeditRange: resolveQuireViewEngineImePreeditRange(options.imePreedit) }),
      styles: displayListStyles,
      ...(options.surfaceConfig === undefined
        ? {}
        : { surfaceConfig: options.surfaceConfig }),
      ...(options.displayListClipRects === undefined
        ? {}
        : { clipRects: options.displayListClipRects }),
      commandCache: caches.displayCommandCache,
      ...(trace === undefined ? {} : { trace }),
      ownerCommandCollector: ownerChunks,
      ...(layerCollector === undefined ? {} : { commandObserver: observeDisplayCommand }),
      retainCompositeCommands: retainCompositeLists,
      ...(options.omitCaretCommands === undefined
        ? {}
        : { omitCaretCommands: options.omitCaretCommands })
    })
  );
  const displayOwnerChunks = traceQuireViewEnginePhase(
    trace,
    "render:finish-display-owner-chunks",
    () => ownerChunks.finish(displayList.bounds)
  );
  const pageDisplayListChunks = pageChunkPages === undefined
    ? undefined
    : traceQuireViewEnginePhase(
        trace,
        "render:realize-page-display-owner-chunks",
        () => realizeQuirePageStackDisplayOwnerChunks({
          pages: pageChunkPages,
          ownerIndex: displayOwnerIndex,
          ownerChunks: displayOwnerChunks,
          bounds: displayList.bounds,
          ...(options.displayListClipRects === undefined
            ? {}
            : { clipRects: options.displayListClipRects })
        })
      );
  const layers = layerCollector === undefined
    ? {
        content: { bounds: displayList.bounds, commands: [] },
        overlay: { bounds: displayList.bounds, commands: [] }
      }
    : traceQuireViewEnginePhase(
        trace,
        "render:finish-display-list-layers",
        () => layerCollector.finish(displayList.bounds)
      );
  const displayChunkCounters = createQuireViewEngineDisplayChunkCounters({
    pageRecordCount: pageChunkPages?.length ?? 0,
    pageChunkCount: pageDisplayListChunks?.chunks.length ?? 0,
    subLayoutRecordCount: displayOwnerIndex.owners.filter(
      (owner) => owner.kind === "sub-layout"
    ).length,
    subLayoutChunkCount: displayOwnerChunks.chunks.filter((chunk) =>
      chunk.owner.kind === "sub-layout" && (
        chunk.contentDisplayList.commands.length > 0
        || chunk.overlayDisplayList.commands.length > 0
      )
    ).length
  });
  const displayOwnerDiagnostics = createQuireRetainedDisplayOwnerDiagnostics({
    ownerIndex: displayOwnerIndex,
    ownerChunkCount: displayOwnerChunks.chunks.length,
    invalidation: displayInvalidation,
    observerBridgeUses: layerCollector === undefined ? 0 : 1
  });

  const canonicalPositionMapping = resolveQuireFramePositionMapping(options);
  return {
    layoutSnapshot,
    interactionSnapshot,
    ...(canonicalPositionMapping === undefined ? {} : { canonicalPositionMapping }),
    ...(options.selectionContext === undefined
      ? {}
      : { selectionContext: options.selectionContext }),
    layoutDirtyRange: options.layoutDirtyRange ?? null,
    updatePatch: options.updatePatch ?? null,
    displayOwnerIndex,
    displayInvalidation,
    displayOwnerDiagnostics,
    displayOwnerChunks,
    cacheCounters: traceQuireViewEnginePhase(
      trace,
      "render:cache-counters",
      () => snapshotQuireViewEngineFrameCacheCounters(caches)
    ),
    selectionGeometry,
    decorationLane,
    displayList,
    contentDisplayList: layers.content,
    overlayDisplayList: layers.overlay,
    ...(pageDisplayListChunks === undefined ? {} : { pageDisplayListChunks }),
    displayChunkCounters,
    domOverlays: [...layoutSnapshot.domOverlays, ...renderTimeDomOverlays],
    viewTargets: [
      ...createQuireActiveLayerViewTargets(layoutSnapshot),
      ...createQuireDecorationCursorTargets(decorationLane),
      ...decorationLane.widgets.map((widget) => widget.target)
    ]
  };
}
