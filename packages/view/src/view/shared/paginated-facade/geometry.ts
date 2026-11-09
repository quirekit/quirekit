import {
  projectEditorUIAnchorGeometry,
  resolveEditorUIAnchorGeometry,
  resolveEditorUIStructuredRangeRects,
  resolveEditorUITextRangeRects
} from "@quirekit/editor-ui";
import type { EditorUIClientAnchorResolution } from "@quirekit/editor-ui";
import type {
  QuireMountedObjectAnchorOccurrence,
  QuireMountedObjectAnchorResolution
} from "@quirekit/core";
import {
  buildQuireTableChromeModel,
  resolveViewCoordinateAuthority
} from "@quirekit/view-engine";
import {
  requireQuireViewInteractionGeometrySnapshot,
  resolveQuireViewCoordsAtPosWithProvenance,
  resolveQuireViewEndOfTextblock,
  resolveQuireViewInteractionGeometrySnapshot,
  resolveQuireViewPosAtCoords
} from "../geometry";
import { resolveMountedRetainedSelectionScrollRect } from "../scroll";
import type {
  CreateMountedPaginatedGeometryFacadeOptions,
  MountedPaginatedGeometryFacade
} from "./types";
import { projectMountedTableChromeModel } from "../table-chrome";
import { readMountedObjectPlacement } from "./object-placement";
import { queryMountedBlockFragments } from "../block-interaction";
import { readMountedTextblockContentWidth } from "./textblock-width";
import { findMountedPageForPosition } from "./page-for-position";
import { readMountedCaretRect } from "./caret";
import { toCanonicalHit, toFramePosition } from "./canonical-positions";

/**
 * Creates the canonical editor-facing geometry facade for a paginated mount.
 *
 * Retained geometry remains authoritative. A backend refinement may replace a
 * concrete retained answer only when its exact measurement capability returns
 * one; absence or a miss falls back to the retained result without inventing
 * identity or coordinate defaults.
 *
 * @param options - Render, surface, selection-context, and refinement accessors.
 * @returns Shared paginated geometry and scroll facade.
 */
export function createMountedPaginatedGeometryFacade(
  options: CreateMountedPaginatedGeometryFacadeOptions
): MountedPaginatedGeometryFacade {
  /**
   * Resolves and projects one version-bound anchor without backend guessing.
   * @param request - Explicit typed anchor request.
   * @returns Client-space geometry or explicit stale/unsupported state.
   */
  const resolveUIAnchor: MountedPaginatedGeometryFacade["resolveUIAnchor"] = (request) => {
    const renderResult = options.readRenderResult();
    if (renderResult === undefined) {
      return {
        status: "unsupported",
        kind: request.kind,
        reason: "snapshot-version-unavailable"
      };
    }

    const geometry = resolveEditorUIAnchorGeometry({
      snapshot: renderResult.interactionSnapshot,
      request
    });
    const surface = options.readSurface();
    return projectEditorUIAnchorGeometry({
      geometry,
      surfaceClientRect: surface.clientRect,
      surfaceBounds: surface.surfaceBounds
    });
  };

  /**
   * Resolves one retained object against the currently committed snapshot.
   *
   * @param objectId - Stable object identity carried by the retained hit target.
   * @param occurrence - Optional exact target or repeated visual occurrence.
   * @returns Client-space object geometry or explicit unsupported/stale state.
   */
  const getObjectAnchor = (
    objectId: string,
    occurrence?: QuireMountedObjectAnchorOccurrence
  ): QuireMountedObjectAnchorResolution => {
    const snapshotVersion = options.readRenderResult()?.interactionSnapshot
      .viewGraph?.version;
    if (!Number.isSafeInteger(snapshotVersion) || Number(snapshotVersion) < 0) {
      return {
        status: "unsupported",
        kind: "object",
        reason: "snapshot-version-unavailable"
      };
    }
    const resolution = resolveUIAnchor({
      kind: "object",
      objectId,
      ...(occurrence === undefined ? {} : { occurrence }),
      expectedSnapshotVersion: Number(snapshotVersion)
    });
    if (resolution.status === "ready") {
      if (resolution.kind !== "object") {
        return {
          status: "unsupported",
          kind: "object",
          snapshotVersion: resolution.snapshotVersion,
          reason: "resolved-geometry-invalid"
        };
      }
      return { ...resolution, placement: readMountedObjectPlacement(options.readRenderResult(), resolution.sourceTargetIds) };
    }
    return { ...resolution, kind: "object" };
  };

  return {
    getCaretRect: () => readMountedCaretRect(options),
    getTextRangeRects: (range, sourceDocument) => resolveEditorUITextRangeRects(options.readRenderResult(), options.readSurface(), range, sourceDocument),
    getStructuredRangeRects: (range, sourceDocument) => resolveEditorUIStructuredRangeRects(options.readRenderResult(), options.readSurface(), range, sourceDocument),
    getTextblockContentWidth: (position, sourceDocument) => readMountedTextblockContentWidth(options, position, sourceDocument),
    queryBlockFragments: clientY => queryMountedBlockFragments(options, clientY),
    getObjectAnchor,
    resolveUIAnchor,
    posAtCoords(coords) {
      const geometrySnapshot = resolveQuireViewInteractionGeometrySnapshot(
        options.readRenderResult()
      );
      if (geometrySnapshot === undefined) {
        return null;
      }

      const surface = options.readSurface();
      const retainedResult = resolveQuireViewPosAtCoords({
        geometrySnapshot,
        coords,
        surfaceClientRect: surface.clientRect,
        ...(surface.surfaceBounds === undefined
          ? {}
          : { surfaceBounds: surface.surfaceBounds })
      });

      const hit = options.refinePosAtCoords?.({
        geometrySnapshot,
        coords,
        surface,
        retainedResult
      }) ?? retainedResult;
      // Retained geometry answers in frame positions; callers expect canonical ones.
      return hit === null ? null : toCanonicalHit(options.readRenderResult(), hit);
    },
    coordsAtPos(canonicalPos, side = 1) {
      const renderResult = options.readRenderResult();
      const geometrySnapshot = requireQuireViewInteractionGeometrySnapshot(
        renderResult,
        "coordsAtPos",
        options.backendLabel
      );
      // Callers pass canonical positions; retained geometry is in frame positions.
      const pos = toFramePosition(renderResult, canonicalPos, side);
      const selectionContext = options.readSelectionContext();
      const surface = options.readSurface();
      const retainedResult = resolveQuireViewCoordsAtPosWithProvenance({
        geometrySnapshot,
        pos,
        side,
        selectionContext,
        surfaceClientRect: surface.clientRect,
        ...(surface.surfaceBounds === undefined
          ? {}
          : { surfaceBounds: surface.surfaceBounds })
      });

      return options.refineCoordsAtPos?.({
        geometrySnapshot,
        pos,
        side,
        selectionContext,
        surface,
        retainedResult
      }) ?? retainedResult.clientRect;
    },
    getTableChrome(tablePos, activePosition) {
      const renderResult = options.readRenderResult();
      if (renderResult === undefined) {
        return null;
      }

      const model = buildQuireTableChromeModel({
        nodes: [renderResult.layoutSnapshot.root],
        tablePos,
        activePosition,
        selectionContext: options.readSelectionContext()
      });
      if (model === null) {
        return null;
      }

      // Project the complete fragment model through the same surface authority
      // as caret and selection geometry so bars cannot drift during page scroll.
      const surface = options.readSurface();
      return {
        ...projectMountedTableChromeModel(
          model,
          resolveViewCoordinateAuthority(surface.clientRect, surface.surfaceBounds)
        ),
        sourceDocument: renderResult.layoutSnapshot.state.doc
      };
    },
    endOfTextblock(direction) {
      const geometrySnapshot = resolveQuireViewInteractionGeometrySnapshot(
        options.readRenderResult()
      );

      return geometrySnapshot === undefined
        ? false
        : resolveQuireViewEndOfTextblock({
            geometrySnapshot,
            direction,
            selectionContext: options.readSelectionContext()
          });
    },
    resolveSelectionScrollRect() {
      const renderResult = options.readRenderResult();
      if (renderResult === undefined) {
        return null;
      }

      const surface = options.readSurface();
      return resolveMountedRetainedSelectionScrollRect({
        renderResult,
        surfaceClientRect: surface.clientRect,
        ...(surface.surfaceBounds === undefined
          ? {}
          : { surfaceBounds: surface.surfaceBounds })
      });
    },
    resolvePageScrollRect(position) {
      const renderResult = options.readRenderResult();
      // Layout pages cover the whole document even where the page stack has not rendered yet.
      const page = renderResult === undefined ? undefined : findMountedPageForPosition(renderResult.layoutSnapshot, position);
      if (page === undefined) return null;
      const surface = options.readSurface();
      const rect = resolveViewCoordinateAuthority(surface.clientRect, surface.surfaceBounds).documentToClientRect(page.pageRect).to;
      return { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height };
    },
    resolvePositionScrollRect(position) {
      const snapshotVersion = options.readRenderResult()?.interactionSnapshot
        .viewGraph?.version ?? -1;

      const anchor = resolveUIAnchor({
        kind: "caret",
        position,
        expectedSnapshotVersion: snapshotVersion
      });
      return anchor.status === "ready"
        ? {
            left: anchor.referenceRect.x,
            right: anchor.referenceRect.x + anchor.referenceRect.width,
            top: anchor.referenceRect.y,
            bottom: anchor.referenceRect.y + anchor.referenceRect.height
          }
        : null;
    }
  };
}
