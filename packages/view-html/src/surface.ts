import type { QuireRect } from "@quirekit/renderer";
import type { HtmlMountedViewRuntimeOptions } from "./types";
import {
  createQuireMountedSurfaceBounds,
  resolveQuireMountedViewportRect
} from "@quirekit/view/mounted-backend";

/** CSS-sized dimensions for a mounted HTML surface. */
export interface HtmlSurfaceSize {
  /** Surface width in CSS pixels. */
  readonly width: number;
  /** Surface height in CSS pixels. */
  readonly height: number;
}

/** Prepared HTML surface state for one mounted render pass. */
export interface HtmlMountedRenderSurfaceState {
  /** CSS-sized HTML dimensions. */
  readonly displaySize: HtmlSurfaceSize;
  /** Viewport rectangle used by layout and overlay clearing. */
  readonly viewportRect: QuireRect;
  /** Logical full-surface bounds used by SVG overlay synchronization. */
  readonly surfaceBounds: QuireRect;
}

/** Options used to resolve mounted HTML surface state. */
export interface HtmlMountedSurfaceStateOptions {
  /** HTML surface that renders persistent content. */
  readonly contentSurface: HTMLElement;
  /** Retained semantic document whose natural flow owns content height. */
  readonly documentRoot: HTMLElement;
  /** SVG surface that renders auxiliary transient overlays independently of selection. */
  readonly overlaySurface: SVGSVGElement;
  /** Optional mounted HTML runtime configuration. */
  readonly runtime?: HtmlMountedViewRuntimeOptions | undefined;
}

/**
 * Reads mounted HTML geometry without performing any DOM writes.
 *
 * @param options - Mounted surfaces and runtime configuration.
 * @returns Measured state consumed by later write phases.
 */
export function measureHtmlMountedSurfaceState(
  options: HtmlMountedSurfaceStateOptions
): HtmlMountedRenderSurfaceState {
  const displaySize = resolveHtmlSurfaceDisplaySize(
    options.contentSurface,
    options.documentRoot,
    options.runtime
  );
  return {
    displaySize,
    viewportRect: resolveQuireMountedViewportRect({
      displaySize,
      viewportRect: options.runtime?.viewportRect,
      viewportPadding: options.runtime?.viewportPadding
    }),
    surfaceBounds: createQuireMountedSurfaceBounds(displaySize)
  };
}

/**
 * Applies previously measured HTML and SVG surface geometry.
 *
 * @param options - Mounted surfaces and runtime configuration.
 * @param state - Geometry measured during the read phase.
 */
export function syncHtmlMountedSurfaceGeometry(
  options: HtmlMountedSurfaceStateOptions,
  state: HtmlMountedRenderSurfaceState
): void {
  syncHtmlContentSurfaceGeometry(
    options.contentSurface,
    state.displaySize,
    options.runtime
  );
  syncHtmlOverlaySurfaceGeometry(options.overlaySurface, state.displaySize);
}

/**
 * Resolves the current CSS display dimensions for a mounted HTML surface.
 *
 * @param surface - HTML content surface to inspect.
 * @param documentRoot - Retained semantic document that owns natural flow height.
 * @param runtime - Optional runtime sizing inputs.
 * @returns CSS-sized HTML surface dimensions.
 */
function resolveHtmlSurfaceDisplaySize(
  surface: HTMLElement,
  documentRoot: HTMLElement,
  runtime: HtmlMountedViewRuntimeOptions | undefined
): HtmlSurfaceSize {
  const surfaceRect = readHtmlBoundingRect(surface);
  const documentRect = readHtmlBoundingRect(documentRoot);
  const naturalHeight = Math.max(
    documentRect.height,
    readHtmlScrollHeight(documentRoot)
  );

  return {
    width: positiveOrFallback(
      surfaceRect.width,
      runtime?.width ?? readStylePixelValue(surface, "width")
    ),
    height: Math.max(
      positiveOrFallback(naturalHeight, 0),
      runtime?.height ?? 0
    )
  };
}

/**
 * Reads intrinsic scroll height without making the outer mount a sizing authority.
 *
 * @param documentRoot - Retained semantic document root.
 * @returns Finite non-negative scroll height.
 */
function readHtmlScrollHeight(documentRoot: HTMLElement): number {
  const height = documentRoot.scrollHeight;
  return Number.isFinite(height) ? Math.max(height, 0) : 0;
}

/**
 * Reads the CSS-space display rectangle for a mounted HTML surface.
 *
 * @param surface - HTML element to inspect.
 * @returns HTML display rectangle.
 */
function readHtmlBoundingRect(surface: HTMLElement): {
  readonly width: number;
  readonly height: number;
} {
  if (typeof surface.getBoundingClientRect !== "function") {
    return { width: 0, height: 0 };
  }

  return surface.getBoundingClientRect();
}

/**
 * Reads a numeric pixel value from an inline style declaration.
 *
 * @param surface - HTML surface to inspect.
 * @param property - Style property to parse.
 * @returns Parsed numeric pixel value.
 */
function readStylePixelValue(
  surface: HTMLElement,
  property: "width" | "height"
): number {
  return Number.parseFloat(surface.style[property] || "0");
}

/**
 * Returns a positive size value or a fallback.
 *
 * @param value - Preferred size value.
 * @param fallback - Fallback size value.
 * @returns Positive size used for rendering.
 */
function positiveOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : Math.max(fallback, 0);
}

/**
 * Synchronizes HTML content surface dimensions to the current display size.
 *
 * @param surface - HTML content surface to update.
 * @param displaySize - CSS-sized display dimensions.
 * @param runtime - Optional runtime sizing inputs.
 */
function syncHtmlContentSurfaceGeometry(
  surface: HTMLElement,
  displaySize: HtmlSurfaceSize,
  runtime: HtmlMountedViewRuntimeOptions | undefined
): void {
  const width = runtime?.width === undefined ? "100%" : `${displaySize.width}px`;
  const height = `${displaySize.height}px`;
  if (surface.style.width !== width) surface.style.width = width;
  if (surface.style.height !== "") surface.style.height = "";
  if (surface.style.minHeight !== height) surface.style.minHeight = height;
}

/**
 * Synchronizes SVG overlay width, height, and viewBox to the current display size.
 *
 * @param svg - SVG overlay surface to update.
 * @param displaySize - CSS-sized display dimensions.
 */
function syncHtmlOverlaySurfaceGeometry(
  svg: SVGSVGElement,
  displaySize: HtmlSurfaceSize
): void {
  svg.style.width = `${displaySize.width}px`;
  svg.style.height = `${displaySize.height}px`;
  svg.setAttribute("width", `${displaySize.width}`);
  svg.setAttribute("height", `${displaySize.height}`);
  svg.setAttribute("viewBox", `0 0 ${displaySize.width} ${displaySize.height}`);
}
