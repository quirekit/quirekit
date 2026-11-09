import type { TextDiagramLanguage } from "@quirekit/text-diagram";
import type { ComponentViewRenderer, MsfeEditor, MsfeSourceRange } from "@quirekit/msfe-core";

/** Host typography resolved only when acquiring a new preview, without a UI package dependency. */
export interface PreviewTypography {
  /** Effective font stack used by the source document. */
  readonly fontFamily: string;
  /** Effective body size in CSS pixels. */
  readonly fontSize: number;
}

/** Static output derived exclusively from the canonical Markdown source. */
export interface PreviewProps {
  /** Source body without the confirmed delimiters. */
  readonly text: string;
  /** Exact source including original delimiters, used for error or default pending fallback. */
  readonly source: string;
  /** Effective canonical editing permission. */
  readonly readOnly: boolean;
  /** Current source interval, relocated by the projection cache before a later mount. */
  readonly range: MsfeSourceRange;
  /** @param range - Current source interval. @returns A mapped, document-scoped source editing intent for this mounted preview. */
  readonly target: (range: MsfeSourceRange) => PreviewTarget;
  /** Which optional renderer owns this body. */
  readonly kind: "inlineMath" | "displayMath" | "mermaid" | "textDiagram";
  /** Grammar for non-Mermaid text diagram previews. */ readonly language?: TextDiagramLanguage;
  /** Parser-confirmed containers owned by a full-line block preview. */
  readonly container?: PreviewContainer;
}

/** Container presentation facts without a duplicated document tree or UI dependency. */
export interface PreviewContainer {
  /** Number of enclosing blockquotes. */
  readonly quotes: number;
  /** Number of enclosing list items. */
  readonly lists: number;
  /** Original list marker when the preview occupies an item's opening line. */
  readonly marker: string;
}

/** A preview control owns only a short-lived mapped source intent. */
export interface PreviewTarget {
  /** @returns Whether the unchanged source was revealed and focused. */
  reveal(): boolean;
  /** Releases the captured source range when the preview is replaced or unmounted. */
  release(): void;
}

/** Semantic preview actions passed to a host's existing component library. */
export interface PreviewControlProps {
  /** Renderer family, for a host-localized action name. */
  readonly kind: PreviewProps["kind"];
  /** Whether source editing is unavailable. */
  readonly readOnly: boolean;
  /** Current asynchronous rendering state; permission-only updates retain it. */
  readonly status: "loading" | "ready" | "error";
  /** Retries the current source under this component's cancellable lifetime. */
  readonly retry: () => void;
  /** @returns Whether the current canonical source was revealed. */
  readonly revealSource: () => boolean;
}

/** Optional host UI; feature packages do not prescribe a product button skin. */
export interface PreviewOptions {
  /** Existing Vue/React/native component adapter for source actions. */
  readonly controls?: ComponentViewRenderer<PreviewControlProps>;
  /**
   * Optional host editor. Capture a separate source anchor when retaining a draft beyond this callback.
   * @param request - Validated current source editing intent.
   * @returns Whether the host accepted this editing request.
   */
  readonly edit?: (request: PreviewEditRequest) => boolean;
  /** How a block preview enters editing: `click` (default) or `dblclick`, leaving single clicks to host selection. Inline formulas always use click. */
  readonly activation?: PreviewActivation;
  /** Mermaid only: show the diagram as an SVG image drawn with system fonts, keeping its stylesheet out of the page. */
  readonly image?: boolean;
}

/** Pointer gesture that opens a block preview's source editing. */
export type PreviewActivation = "click" | "dblclick";

/** Internal source-bound successful output cache; it never retains editing targets or pending requests. */
export interface PreviewOutputCache {
  /** @param props - Exact semantic body. @param owner - Mounted output's document. @param typography - Current font role, when known. @returns Previously accepted safe output, if eligible. */
  get(props: PreviewProps, owner: Document, typography?: PreviewTypography): string | undefined;
  /** @param props - Original accepted request body. @param owner - Mounted document. @param html - Successful safe output. @param typography - Font role the output was laid out with. */
  set(props: PreviewProps, owner: Document, html: string, typography?: PreviewTypography): void;
}

/** Internal presentation policy chosen by each renderer family. */
export interface PreviewRendererOptions {
  /** Whether pending output falls back to source; false leaves space to host loading presentation. */
  readonly loadingSource?: boolean;
  /** Optional synchronous cache, valid only for the renderer's explicit visual dependencies. */
  readonly cache?: PreviewOutputCache;
  /** Block preview editing gesture chosen by the host. */
  readonly activation?: PreviewActivation;
}

/** An explicit editing request after the preview's mapped source has been validated. */
export interface PreviewEditRequest {
  /** Canonical transaction owner; the host must respect read-only and composition guards. */
  readonly editor: MsfeEditor;
  /** Current, unchanged source interval including delimiters. */
  readonly range: MsfeSourceRange;
  /** Formula or fenced diagram family. */
  readonly kind: PreviewProps["kind"];
}
