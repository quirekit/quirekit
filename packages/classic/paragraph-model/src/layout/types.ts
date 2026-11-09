import type { Node } from "@quirekit/pm";
import type { WordParagraphAlignment } from "../types";

/** Paragraph indentation in CSS pixels on the logical axis. */
export interface WordParagraphModelIndentation {
  /** Inset from logical start. */
  readonly start: number;
  /** Inset from logical end. */
  readonly end: number;
  /** First-line offset; negative values hang. */
  readonly firstLine: number;
}

/** Paragraph border side in CSS pixels. */
export interface WordParagraphModelBorder {
  /** OOXML border style token. */
  readonly style: string;
  /** CSS stroke color, omitted for automatic color. */
  readonly strokeStyle?: string | undefined;
  /** Border width in CSS pixels. */
  readonly lineWidth: number;
  /** Distance from paragraph content in CSS pixels. */
  readonly space: number;
}

/** Paragraph-mark typography in CSS terms. */
export interface WordParagraphModelMarkTypography {
  /** Explicit bold, or null to inherit. */
  readonly bold: boolean | null;
  /** Explicit italic, or null to inherit. */
  readonly italic: boolean | null;
  /** Font size in CSS pixels, or null to inherit. */
  readonly fontSize: number | null;
  /** Font family, or null to inherit. */
  readonly fontFamily: string | null;
  /** Explicit underline, or null to inherit. */
  readonly underline: boolean | null;
  /** Explicit strike-through, or null to inherit. */
  readonly strike: boolean | null;
  /** Explicit color, or null for automatic color. */
  readonly color: string | null;
}

/** Effective Word paragraph formatting projected for a layout engine. */
export interface WordParagraphModelFormatting {
  /** Neutral Han boundary spacing, in fractions of the ideographic font's em. */
  readonly autoSpacing?: {
    /** Latin letter boundary ratio. */
    readonly ideographAlpha?: number | undefined;
    /** ASCII numeric boundary ratio. */
    readonly ideographNumeric?: number | undefined;
  } | undefined;
  /** Protect basic Chinese punctuation boundaries; defaults to true. */
  readonly avoidPunctuationBreaks?: boolean | undefined;
  /** Admitted explicit tab stops in CSS pixels, relative to the text-area edge. */
  readonly tabs?: {
    /** Stops in increasing logical position. */
    readonly stops: readonly {
      /** Logical distance from the unindented content edge. */
      readonly position: number;
      /** Alignment of the following tab field. */
      readonly alignment: "start" | "center" | "end";
      /** Repeated paint character; absent for no leader. */
      readonly leader?: string | undefined;
    }[];
    /** Positive default grid interval in CSS pixels after the final explicit stop. */
    readonly defaultInterval?: number | undefined;
  } | undefined;
  /** Effective Word formatting, passed back to this model. */
  readonly token: unknown;
  /** Stable identity of every layout-affecting field. */
  readonly signature: string;
  /** Effective Word indentation. */
  readonly indentation: unknown;
  /** Logical alignment, or null for start. */
  readonly alignment: WordParagraphAlignment | null;
  /** Explicit base direction, or null to infer. */
  readonly direction: "ltr" | "rtl" | null;
  /** Document-grid snapping, or null to inherit participation. */
  readonly snapToGrid: boolean | null;
  /** Line spacing rule and value in lines or CSS pixels, or null for single spacing. */
  readonly lineSpacing: {
    /** Rule used to compute the line advance. */
    readonly mode: "exact" | "at-least" | "multiple";
    /** Multiplier or physical height in CSS pixels. */
    readonly value: number;
    /** Baseline fraction used only for exact line boxes. */
    readonly exactBaselineRatio?: number | undefined;
  } | null;
  /** Whether line metrics come from measured glyphs rather than the inherited strut. */
  readonly naturalLineMetrics: boolean;
  /** Block pagination policy including Word's widow and orphan default. */
  readonly pagination: {
    readonly breakBefore?: "page" | undefined;
    readonly keepTogether?: boolean | undefined;
    readonly keepWithNext?: boolean | undefined;
    readonly widows?: number | undefined;
    readonly orphans?: number | undefined;
  };
  /** Paragraph-mark typography, or null when the paragraph mark carries none. */
  readonly markTypography: WordParagraphModelMarkTypography | null;
  /** Shading fill and logical borders, or null for a plain paragraph. */
  readonly decoration: {
    /** Symmetric expansion of the text indentation interval in CSS pixels. */
    readonly inlineOutset?: number | undefined;
    readonly fill?: string | undefined;
    readonly top?: WordParagraphModelBorder | undefined;
    readonly bottom?: WordParagraphModelBorder | undefined;
    readonly start?: WordParagraphModelBorder | undefined;
    readonly end?: WordParagraphModelBorder | undefined;
  } | null;
}

/**
 * Word paragraph semantics shaped for a layout engine's paragraph model.
 *
 * The shape is structural so this package stays independent of any engine;
 * `@quirekit/classic-layout` registers it with the canvas engine.
 */
export interface WordParagraphModelSemantics {
  /** Reads a paragraph node's direct Word indentation. */
  readonly nodeIndentation: (node: Node) => unknown;
  /** Resolves Word indentation into CSS pixels for a character pitch in CSS pixels. */
  readonly resolveIndentation: (indentation: unknown, characterPitch: number,
    characterGrid?: WordParagraphModelCharacterGrid | null) => WordParagraphModelIndentation;
  /** Reads whether justified lines ending in a soft break stretch. */
  readonly justifySoftBreaks: (doc: Node) => boolean;
  /** Resolves line metrics from the paragraph's line spacing and natural metrics in CSS pixels. */
  readonly lineMetrics: (formatting: WordParagraphModelFormatting, naturalLineHeight: number, naturalBaselineOffset: number) =>
    { readonly lineHeight: number; readonly baselineOffset: number; readonly mode: "minimum" | "exact" };
  /** Resolves space before and after the paragraph in CSS pixels. */
  readonly blockSpacing: (formatting: WordParagraphModelFormatting, lineHeight: number) =>
    { readonly before: number; readonly after: number };
}

/** Neutral container allocation used only to resolve relative paragraph geometry. */
export interface WordParagraphModelCharacterGrid {
  /** Natural-width spacing or integral cell allocation. */
  readonly mode: "spacing" | "cells";
  /** Extra CSS pixels added to the paragraph's natural character width. */
  readonly spacing: number;
  /** CSS pixel distance between strict cell boundaries. */
  readonly pitch: number;
}
