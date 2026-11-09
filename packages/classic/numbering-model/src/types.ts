import type {
  WordParagraphTabStop,
  WordParagraphIndentation,
  WordParagraphSelectionContext
} from "@quirekit/classic-paragraph-model";

/** Number formats represented and resolved by canonical Word numbering. */
export type WordNumberingFormat =
  | "aiueo"
  | "aiueoFullWidth"
  | "arabicAbjad"
  | "arabicAlpha"
  | "bahtText"
  | "bullet"
  | "cardinalText"
  | "chicago"
  | "chineseCounting"
  | "chineseCountingThousand"
  | "chineseLegalSimplified"
  | "chosung"
  | "custom"
  | "decimal"
  | "decimalEnclosedCircle"
  | "decimalEnclosedCircleChinese"
  | "decimalEnclosedFullstop"
  | "decimalEnclosedParen"
  | "decimalFullWidth"
  | "decimalFullWidth2"
  | "decimalHalfWidth"
  | "decimalZero"
  | "dollarText"
  | "ganada"
  | "hebrew1"
  | "hebrew2"
  | "hex"
  | "hindiConsonants"
  | "hindiCounting"
  | "hindiNumbers"
  | "hindiVowels"
  | "ideographDigital"
  | "ideographEnclosedCircle"
  | "ideographLegalTraditional"
  | "ideographTraditional"
  | "ideographZodiac"
  | "ideographZodiacTraditional"
  | "iroha"
  | "irohaFullWidth"
  | "japaneseCounting"
  | "japaneseDigitalTenThousand"
  | "japaneseLegal"
  | "koreanCounting"
  | "koreanDigital"
  | "koreanDigital2"
  | "koreanLegal"
  | "lowerLetter"
  | "lowerRoman"
  | "none"
  | "numberInDash"
  | "ordinal"
  | "ordinalText"
  | "russianLower"
  | "russianUpper"
  | "taiwaneseCounting"
  | "taiwaneseCountingThousand"
  | "taiwaneseDigital"
  | "thaiCounting"
  | "thaiLetters"
  | "thaiNumbers"
  | "upperLetter"
  | "upperRoman"
  | "vietnameseCounting";

/** Canonical numbering formats that consume a numeric counter. */
export type WordNumberingCounterFormat = Exclude<WordNumberingFormat, "bullet">;

/** Content inserted between a generated marker and editable paragraph text. */
export type WordNumberingSuffix = "tab" | "space" | "nothing";

/** Logical marker alignment inside the first-line hanging region. */
export type WordNumberingJustification = "start" | "center" | "end";

/** Product-visible kinds derived from numbering and optional task metadata. */
export type WordListKind = "ordered" | "bullet" | "task";

/** OOXML font hint retained for one numbering-marker run. */
export type WordNumberingMarkerFontHint = "default" | "eastAsia" | "cs";

/** OOXML theme-font reference retained for one numbering-marker run slot. */
export type WordNumberingMarkerThemeFont =
  | "majorAscii"
  | "majorBidi"
  | "majorEastAsia"
  | "majorHAnsi"
  | "minorAscii"
  | "minorBidi"
  | "minorEastAsia"
  | "minorHAnsi";

/** Explicit OOXML language slots attached to one numbering-marker run. */
export interface WordNumberingLanguage {
  /** Default Latin or general language tag. */
  readonly value?: string | undefined;
  /** East Asian language tag used by ideographic marker formats. */
  readonly eastAsia?: string | undefined;
  /** Bidirectional language tag used by Arabic and Hebrew marker formats. */
  readonly bidi?: string | undefined;
}

/** Context required by language-aware and custom counter formatters. */
export interface WordNumberingCounterFormatOptions {
  /** Explicit marker-run language slots. */
  readonly language?: WordNumberingLanguage | undefined;
  /** Office 2010 expression accompanying `w:numFmt w:val="custom"`. */
  readonly customFormat?: string | undefined;
}

/** Explicit font slots attached to one numbering marker run. */
export interface WordNumberingMarkerFonts {
  /** Latin ASCII marker font family. */
  readonly ascii?: string | undefined;
  /** High ANSI marker font family. */
  readonly highAnsi?: string | undefined;
  /** East Asian marker font family. */
  readonly eastAsia?: string | undefined;
  /** Complex-script marker font family. */
  readonly complexScript?: string | undefined;
  /** Theme reference overriding the literal ASCII family for effective display. */
  readonly asciiTheme?: WordNumberingMarkerThemeFont | undefined;
  /** Theme reference overriding the literal high-ANSI family for effective display. */
  readonly highAnsiTheme?: WordNumberingMarkerThemeFont | undefined;
  /** Theme reference overriding the literal East Asian family for effective display. */
  readonly eastAsiaTheme?: WordNumberingMarkerThemeFont | undefined;
  /** Theme reference overriding the literal complex-script family for effective display. */
  readonly complexScriptTheme?: WordNumberingMarkerThemeFont | undefined;
  /** OOXML character-slot hint retained for exact regeneration. */
  readonly hint?: WordNumberingMarkerFontHint | undefined;
}

/** Admitted numbering-level marker typography expressed as a style delta. */
export interface WordNumberingMarkerStyle {
  /** Explicit marker font slots, when the level overrides paragraph typography. */
  readonly fonts?: WordNumberingMarkerFonts | undefined;
  /** Explicit marker font size in points, constrained to OOXML half-point granularity. */
  readonly fontSizePt?: number | undefined;
  /** Explicit complex-script marker font size in points. */
  readonly complexScriptFontSizePt?: number | undefined;
  /** Explicit bold on/off override. */
  readonly bold?: boolean | undefined;
  /** Explicit complex-script bold on/off override. */
  readonly complexScriptBold?: boolean | undefined;
  /** Explicit italic on/off override. */
  readonly italic?: boolean | undefined;
  /** Explicit complex-script italic on/off override. */
  readonly complexScriptItalic?: boolean | undefined;
  /** RGB CSS color (`#RRGGBB`) or `auto`. */
  readonly color?: string | undefined;
  /** Explicit single-underline on/off override. */
  readonly underline?: boolean | undefined;
  /** Explicit single-strike on/off override. */
  readonly strike?: boolean | undefined;
  /** Explicit marker-run language slots used by textual number formats. */
  readonly language?: WordNumberingLanguage | undefined;
}

/** One reusable Word numbering level in an abstract definition. */
export interface WordNumberingLevel {
  /** Zero-based level index in Word's supported zero-to-eight range. */
  readonly level: number;
  /** Counter or literal-bullet format. */
  readonly format: WordNumberingFormat;
  /** Office 2010 custom-number expression retained when `format` is `custom`. */
  readonly customFormat?: string | undefined;
  /** OOXML-like marker template, such as `%1.` or a literal bullet. */
  readonly text: string;
  /** First numeric counter value for this level. */
  readonly start: number;
  /**
   * Ancestor level that restarts this counter, `null` for never, or omitted
   * for the OOXML default of the immediately preceding level.
   */
  readonly restartAfterLevel?: number | null | undefined;
  /** Separator following the generated marker. */
  readonly suffix: WordNumberingSuffix;
  /** Logical marker alignment inside the hanging region. */
  readonly justification: WordNumberingJustification;
  /** Whether referenced counters use decimal legal-numbering formatting. */
  readonly isLegal?: boolean | undefined;
  /** Associated paragraph style retained for file interoperability. */
  readonly paragraphStyleId?: string | undefined;
  /** Level tab stops; omission retains legacy authoring stops, empty means default stops. */
  readonly paragraphTabs?: readonly WordParagraphTabStop[] | undefined;
  /** Paragraph indentation inherited by list paragraphs at this level. */
  readonly paragraphIndentation: WordParagraphIndentation;
  /** Optional marker-only typography merged over the paragraph marker base. */
  readonly markerStyle?: WordNumberingMarkerStyle | undefined;
}

/** Abstract numbering definition shared by concrete list instances. */
export interface WordAbstractNumbering {
  /** Stable definition identifier. */
  readonly id: string;
  /** Product-visible family represented by this definition. */
  readonly kind: WordListKind;
  /** Source paragraph-style association, preserved independently of editable levels. */
  readonly styleLink?: string | undefined;
  /** Source numbering-style indirection retained for interoperability. */
  readonly numStyleLink?: string | undefined;
  /** Linked source retained for untouched round trips; generated numbering uses materialized levels. */
  readonly resolvedNumStyleLink?: boolean;
  /** Levels keyed by their zero-based numeric index. */
  readonly levels: Readonly<Record<string, WordNumberingLevel>>;
}

/** One concrete numbering instance with an independent counter sequence. */
export interface WordNumberingInstance {
  /** Stable concrete list identifier referenced by paragraphs. */
  readonly id: string;
  /** Referenced abstract numbering definition identifier. */
  readonly abstractNumId: string;
}

/** Document-level registry persisted on the canonical ProseMirror document. */
export interface WordNumberingRegistry {
  /** Abstract definitions keyed by stable id. */
  readonly abstractNums: Readonly<Record<string, WordAbstractNumbering>>;
  /** Concrete list instances keyed by stable id. */
  readonly nums: Readonly<Record<string, WordNumberingInstance>>;
  /** Persisted counter kept for documents that carry it; list ids are uuids and do not read it. */
  readonly nextInstanceId: number;
}

/** Payload for append-only reconciliation of an auxiliary Story registry. */
export interface MergeWordNumberingRegistryOptions {
  /** Complete transient registry whose new identities should be installed. */
  readonly registry: WordNumberingRegistry;
}

/** Task state retained by a Word list paragraph. */
export interface WordTaskState {
  /** Whether the task marker is currently checked. */
  readonly checked: boolean;
}

/** Flat paragraph reference to one concrete Word numbering instance. */
export interface WordParagraphNumbering {
  /** Concrete numbering instance id. */
  readonly numId: string;
  /** Zero-based numbering level. */
  readonly level: number;
  /** Optional paragraph-local counter restart value. */
  readonly startOverride: number | null;
  /** Optional task state; null for ordinary bullets and ordered lists. */
  readonly task: WordTaskState | null;
}

/**
 * Paragraph `wordNumbering` value that explicitly removes numbering inherited from
 * the paragraph style, matching a direct OOXML `w:numId="0"`.
 */
export type WordParagraphNumberingSuppression = "none";

/** Numbering that applies to one paragraph after direct and style sources are combined. */
export interface ResolvedWordEffectiveParagraphNumbering {
  /** Effective numbering reference. */
  readonly numbering: WordParagraphNumbering;
  /** Whether the reference is direct paragraph formatting or inherited from the style chain. */
  readonly source: "direct" | "style";
  /** Style that declared the inherited reference; null for direct numbering. */
  readonly sourceStyleId: string | null;
}

/** Renderer-neutral generated marker keyed to one paragraph position. */
export interface ResolvedWordNumberingMarker {
  /** Absolute document position immediately before the paragraph node. */
  readonly position: number;
  /** Generated visible marker text. */
  readonly text: string;
  /** Counter value of the paragraph's own level, the number its marker shows; set by the document resolver. */
  readonly counter?: number | undefined;
  /** Immutable counter context at this paragraph; absent ancestors retain their declared starts. */
  readonly counterValues?: readonly (number | undefined)[];
  /** Product-visible marker family. */
  readonly kind: WordListKind;
  /** Concrete numbering instance id. */
  readonly numId: string;
  /** Zero-based numbering level. */
  readonly level: number;
  /** Separator following the marker. */
  readonly suffix: WordNumberingSuffix;
  /** Logical marker alignment in the hanging region. */
  readonly justification: WordNumberingJustification;
  /** Numbering-level indentation before direct paragraph formatting is merged. */
  readonly levelIndentation: WordParagraphIndentation;
  /** Effective paragraph indentation after level/default merging. */
  readonly indentation: WordParagraphIndentation;
  /** Document default tab interval in twips. */
  readonly defaultTabStopTwips?: number | undefined;
  /** Effective custom tab stops in paragraph logical coordinates. */
  readonly tabs?: readonly WordParagraphTabStop[] | undefined;
  /** Checked state for task markers, otherwise null. */
  readonly checked: boolean | null;
  /** Numbering-level marker typography delta, when explicitly declared. */
  readonly markerStyle?: WordNumberingMarkerStyle | undefined;
}

/** Selection summary used by product controls without reading raw attrs. */
export interface WordNumberingSelectionState {
  /** Uniform list kind, null for plain paragraphs, or `mixed`. */
  readonly kind: WordListKind | "mixed" | null;
  /** Uniform level, null when plain or mixed. */
  readonly level: number | null;
  /** Uniform task checked state, null outside a uniform task selection. */
  readonly checked: boolean | null;
  /** Number of paragraph-like blocks covered by the selection. */
  readonly paragraphCount: number;
}

/** Exact ordered-marker actions derived from canonical sequence order. */
export interface WordNumberingSequenceActionState {
  /** Whether the target may start a new counter sequence at its current level. */
  readonly canRestart: boolean;
  /** Whether the target is a sequence start from which continuation may be requested. */
  readonly canContinue: boolean;
  /** Nearest compatible preceding concrete sequence, or null when none exists. */
  readonly continuationNumId: string | null;
}

/** Result of creating one concrete numbering instance immutably. */
export interface CreateWordNumberingInstanceResult {
  /** Updated registry containing the new instance. */
  readonly registry: WordNumberingRegistry;
  /** Stable id assigned to the new instance. */
  readonly numId: string;
}

/** Options for a toolbar or automatic ordered-list toggle. */
export interface ToggleWordOrderedListOptions {
  /** Optional start value derived from an automatic typed prefix. */
  readonly start?: number | undefined;
}

/** Options for an automatic task-list toggle. */
export interface ToggleWordTaskListOptions {
  /** Initial checked state derived from the typed task prefix. */
  readonly checked?: boolean | undefined;
}

/** Options for explicitly setting selected task state. */
export interface SetWordTaskCheckedOptions {
  /** Checked state written to selected task paragraphs. */
  readonly checked: boolean;
}

/** Options for toggling one task paragraph without moving the editor selection. */
export interface ToggleWordTaskAtPositionOptions {
  /** Absolute document position immediately before the task paragraph node. */
  readonly position: number;
}

/** Payload carried by a renderer-neutral Word numbering marker target. */
export interface WordNumberingMarkerEventPayload {
  /** Absolute document position immediately before the owning paragraph. */
  readonly position: number;
  /** Complete paragraph range represented by the marker. */
  readonly range: { readonly from: number; readonly to: number };
  /** Product-visible marker family. */
  readonly kind: WordListKind;
  /** Concrete numbering instance id. */
  readonly numId: string;
  /** Zero-based numbering level. */
  readonly level: number;
  /** Visible marker text used by numbering and accessibility consumers. */
  readonly text: string;
  /** Current task state, or null for ordinary bullets and numbering. */
  readonly checked: boolean | null;
}

/** Browser event detail emitted when product UI should open for a list marker. */
export interface WordNumberingMarkerMenuEventDetail {
  /** Semantic marker identity supplied by the retained View target. */
  readonly marker: WordNumberingMarkerEventPayload;
  /** Browser client point used to anchor the product popmenu. */
  readonly clientPoint: { readonly x: number; readonly y: number };
}

/** Options for restarting selected ordered-list paragraphs. */
export interface RestartWordNumberingOptions {
  /** Positive counter value used at the first selected paragraph. */
  readonly start: number;
}

/** Options for clearing or continuing numbering at one marker-owned paragraph. */
export interface WordNumberingAtPositionOptions {
  /** Absolute document position immediately before the paragraph node. */
  readonly position: number;
}

/** Options for restarting numbering at one marker-owned paragraph. */
export interface RestartWordNumberingAtPositionOptions
  extends WordNumberingAtPositionOptions {
  /** Non-negative counter value written as the paragraph-local restart value. */
  readonly start: number;
}

/** Numbering-aware paragraph ruler context. */
export type WordNumberingParagraphSelectionContext = WordParagraphSelectionContext;
