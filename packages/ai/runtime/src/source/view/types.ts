import type { QuireAiAnnotation, QuireAiSourceBlockPresentation } from "@quirekit/ai-contract";
import type { QuireAiSourceBlock } from "../types";

/** A source block as the view lists it. */
export interface QuireAiSourceViewBlock extends QuireAiSourceBlock {
  /** Block id. */
  readonly id: string;
  /** Own source with the container indentation of continuation lines removed. */
  readonly text: string;
  /** Summary a fact shows instead of the source, when one applies. */
  readonly summary?: QuireAiSourceBlockPresentation | undefined;
  /** Ids of annotations attached in this block. */
  readonly annotations: readonly string[];
}

/** An annotation as the view lists it. */
export interface QuireAiSourceViewAnnotation {
  /** Annotation id issued by the core, such as `c2`. */
  readonly id: string;
  /** Block the annotation starts in, or null when its text is lost. */
  readonly block: string | null;
  /** Feature fact. */
  readonly annotation: QuireAiAnnotation;
  /** Section label of the fact that declared it. */
  readonly label: string;
}

/** Snapshot of the document as the view sees it. */
export interface QuireAiSourceSnapshot {
  /** Current text. */
  readonly text: string;
  /** Blocks in order, parents before children. */
  readonly blocks: readonly QuireAiSourceViewBlock[];
  /** Annotations in document order. */
  readonly annotations: readonly QuireAiSourceViewAnnotation[];
}

/** One rendered window of the view. */
export interface QuireAiSourceView {
  /** Model-visible text. */
  readonly text: string;
  /** Blocks listed. */
  readonly listed: number;
  /** Blocks in the document, or matching the search. */
  readonly total: number;
  /** Block to continue from, when more remain. */
  readonly next?: string | undefined;
  /** Occurrences of the searched text in all, when searching. */
  readonly occurrences: number;
}
