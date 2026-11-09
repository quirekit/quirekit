import type { QuireEditor } from "@quirekit/core";
import type { QuireLayoutNode, QuireRetainedLayoutSnapshot } from "@quirekit/view-engine";
import type { QuireMountedRenderResult } from "@quirekit/view/mounted-backend";
import type { HtmlRetainedDocumentView } from "../document";
import type { HtmlContinuousFlowDomGeometry } from "../presentation/types";
import type { HtmlMountedRenderSurfaceState } from "../surface";

/** Actual continuous DOM products; engine cache, page chunks and paint owners are not produced. */
export type HtmlFlowRenderResult = Pick<QuireMountedRenderResult,
  "layoutSnapshot" | "interactionSnapshot" | "selectionGeometry" | "decorationLane" |
  "displayList" | "contentDisplayList" | "overlayDisplayList" | "domOverlays" |
  "viewTargets" | "updatePatch"
>;

/** Inputs for one continuous-flow geometry publication. */
export interface HtmlFlowGeometryOptions {
  /** Canonical document and semantic adapter registrations. */
  readonly editor: QuireEditor;
  /** DOM ownership and persistent descriptor tree. */
  readonly documentView: HtmlRetainedDocumentView;
  /** Origin of browser geometry in client coordinates. */
  readonly surface: HTMLElement;
  /** Continuous document bounds and viewport. */
  readonly surfaceState: HtmlMountedRenderSurfaceState;
  /** Verified complete native-flow boxes, when the retained geometry owner can reuse them. */
  readonly retainedBlocks?: readonly QuireLayoutNode[] | undefined;
  /** Previous index whose entry topology matches retainedBlocks exactly. */
  readonly previousSnapshot?: QuireRetainedLayoutSnapshot | undefined;
  /** Records actual native block measurements, independently of source traversal. */
  readonly onBlockRead?: (() => void) | undefined;
}

/** Inputs for presenting a selection against an already current DOM snapshot. */
export interface HtmlFlowRenderOptions {
  /** Current document's block geometry and compiled semantic structure. */
  readonly snapshot: QuireRetainedLayoutSnapshot;
  /** Continuous document bounds and viewport. */
  readonly surfaceState: HtmlMountedRenderSurfaceState;
  /** Selection measured in the same ordered browser read phase. */
  readonly domGeometry: HtmlContinuousFlowDomGeometry;
  /** Typed transaction evidence exposed to diagnostics. */
  readonly updatePatch: QuireMountedRenderResult["updatePatch"];
}
