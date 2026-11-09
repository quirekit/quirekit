/** Absolute or character-relative measurement retained by a Word paragraph. */
export type WordParagraphMeasurement =
  | WordParagraphDxaMeasurement
  | WordParagraphCharacterMeasurement;

/** Absolute Word paragraph measurement in twentieths of a point. */
export interface WordParagraphDxaMeasurement {
  /** Stable absolute-unit discriminator. */
  readonly unit: "dxa";
  /** Signed distance in twentieths of a point. */
  readonly value: number;
}

/** Relative Word paragraph measurement in hundredths of one character. */
export interface WordParagraphCharacterMeasurement {
  /** Stable character-relative unit discriminator. */
  readonly unit: "character";
  /** Signed distance in hundredths of the effective character pitch. */
  readonly value: number;
}

/** Normalized logical paragraph indentation retained in the document model. */
export interface WordParagraphIndentation {
  /** Logical start inset from the active text column, or inherited zero. */
  readonly start: WordParagraphMeasurement | null;
  /** Logical end inset from the active text column, or inherited zero. */
  readonly end: WordParagraphMeasurement | null;
  /** Signed first-line delta; negative values represent hanging indentation. */
  readonly firstLine: WordParagraphMeasurement | null;
}

/** Custom tab alignment kinds compatible with Word ruler semantics. */
export type WordParagraphTabAlignment =
  | "start"
  | "center"
  | "end"
  | "decimal"
  | "bar"
  | "num"
  | "clear";

/** One explicit paragraph tab stop retained for the later ruler context. */
export interface WordParagraphTabStop {
  /** Position from the logical text-column start. */
  readonly position: WordParagraphMeasurement;
  /** Text alignment applied at the stop. */
  readonly alignment: WordParagraphTabAlignment;
  /** Optional leader style retained from the source document. */
  readonly leader?: string | null | undefined;
}

/** Word line-spacing rules stored by `w:pPr/w:spacing`. */
export type WordParagraphLineSpacingRule = "auto" | "exact" | "atLeast";

/** Logical paragraph alignment independent of physical writing direction. */
export type WordParagraphAlignment =
  | "start"
  | "center"
  | "end"
  | "justify"
  | "distribute";

/** Explicit base direction retained by a Word paragraph. */
export type WordParagraphDirection = "ltr" | "rtl";

/** Typed paragraph line spacing with OOXML-compatible units. */
export interface WordParagraphLineSpacing {
  /**
   * Line-box rule. `auto` scales the natural line, `exact` fixes the line box,
   * and `atLeast` establishes a minimum.
   */
  readonly rule: WordParagraphLineSpacingRule;
  /**
   * Positive OOXML value: 240ths of a line for `auto`, twips for physical
   * `exact` and `atLeast` spacing.
   */
  readonly value: number;
}

/** Paragraph-owned spacing before, after, and between visual lines. */
export interface WordParagraphSpacing {
  /** Space before the paragraph in twips, or null when inherited. */
  readonly before: WordParagraphDxaMeasurement | null;
  /** Space before the paragraph in hundredths of one effective line. */
  readonly beforeLines: number | null;
  /** Whether producer-defined automatic before spacing is enabled. */
  readonly beforeAutoSpacing: boolean | null;
  /** Space after the paragraph in twips, or null when inherited. */
  readonly after: WordParagraphDxaMeasurement | null;
  /** Space after the paragraph in hundredths of one effective line. */
  readonly afterLines: number | null;
  /** Whether producer-defined automatic after spacing is enabled. */
  readonly afterAutoSpacing: boolean | null;
  /** Explicit line spacing, or null when inherited. */
  readonly line: WordParagraphLineSpacing | null;
}

/** Pagination constraints retained by one Word paragraph. */
export interface WordParagraphPagination {
  /** Whether Word should avoid a single line at a page boundary. */
  readonly widowControl: boolean | null;
  /** Whether this paragraph should remain on the same page as the next one. */
  readonly keepNext: boolean | null;
  /** Whether all lines of this paragraph should remain on one page. */
  readonly keepLines: boolean | null;
  /** Whether this paragraph must begin on a new page. */
  readonly pageBreakBefore: boolean | null;
}

/** Document-grid participation retained by one Word paragraph. */
export interface WordParagraphDocumentGrid {
  /** Whether the logical end indent is adjusted against the document grid. */
  readonly adjustRightIndent: boolean | null;
  /** Whether paragraph text snaps to the active document grid. */
  readonly snapToGrid: boolean | null;
}

/** East Asian line-layout switches retained by one Word paragraph. */
export interface WordParagraphEastAsianLayout {
  /** Whether spacing is inserted between East Asian and Latin text. */
  readonly autoSpaceLatin: boolean | null;
  /** Whether spacing is inserted between East Asian text and numbers. */
  readonly autoSpaceNumber: boolean | null;
  /** Whether Latin words may wrap according to the Word paragraph setting. */
  readonly wordWrap: boolean | null;
  /** Whether East Asian kinsoku line-breaking rules are enabled. */
  readonly kinsoku: boolean | null;
  /** Whether hanging punctuation may extend beyond the text boundary. */
  readonly overflowPunctuation: boolean | null;
  /** Whether punctuation at the beginning of a line may be compressed. */
  readonly compressLineStartPunctuation: boolean | null;
}

/** One paragraph border side retained in OOXML-native measurement units. */
export interface WordParagraphBorder {
  /** OOXML border-style token such as `single`, `dashed`, or `double`. */
  readonly style: string;
  /** Direct RGB color with a leading hash, `auto`, or null when inherited. */
  readonly color: string | "auto" | null;
  /** Optional theme-color token retained until theme evaluation is available. */
  readonly themeColor: string | null;
  /** Optional theme tint retained as the producer's hexadecimal token. */
  readonly themeTint: string | null;
  /** Optional theme shade retained as the producer's hexadecimal token. */
  readonly themeShade: string | null;
  /** Border width in eighths of one point, or null when omitted. */
  readonly sizeEighthPoints: number | null;
  /** Distance from paragraph content in points, or null when omitted. */
  readonly spacePoints: number | null;
  /** Whether the producer requested a border shadow. */
  readonly shadow: boolean | null;
  /** Whether the producer requested a frame effect. */
  readonly frame: boolean | null;
}

/** Complete logical paragraph border topology. */
export interface WordParagraphBorders {
  /** Border on the paragraph block-start edge. */
  readonly top: WordParagraphBorder | null;
  /** Border on the paragraph inline-start edge. */
  readonly start: WordParagraphBorder | null;
  /** Border on the paragraph block-end edge. */
  readonly bottom: WordParagraphBorder | null;
  /** Border on the paragraph inline-end edge. */
  readonly end: WordParagraphBorder | null;
  /** Border between compatible adjacent paragraphs. */
  readonly between: WordParagraphBorder | null;
  /** Word bar border on the logical outside edge. */
  readonly bar: WordParagraphBorder | null;
}

/** Paragraph shading retained independently from inline text shading. */
export interface WordParagraphShading {
  /** OOXML shading-pattern token, normally `clear`. */
  readonly pattern: string;
  /** Pattern foreground RGB color, `auto`, or null when omitted. */
  readonly color: string | "auto" | null;
  /** Background fill RGB color, `auto`, or null when omitted. */
  readonly fill: string | "auto" | null;
  /** Optional foreground theme-color token. */
  readonly themeColor: string | null;
  /** Optional fill theme-color token. */
  readonly themeFill: string | null;
  /** Optional theme fill tint retained as the producer's token. */
  readonly themeFillTint: string | null;
  /** Optional theme fill shade retained as the producer's token. */
  readonly themeFillShade: string | null;
}

/** Character formatting owned by the Word paragraph end mark. */
export interface WordParagraphMarkFormatting {
  /** Direct Latin font family, or null when inherited. */
  readonly fontFamily: string | null;
  /** Direct font size in points, or null when inherited. */
  readonly fontSizePt: number | null;
  /** Direct bold state, or null when inherited. */
  readonly bold: boolean | null;
  /** Direct italic state, or null when inherited. */
  readonly italic: boolean | null;
  /** Direct text color with a leading hash, `auto`, or null when inherited. */
  readonly color: string | "auto" | null;
  /** Direct underline state, or null when inherited. */
  readonly underline: boolean | null;
  /** Direct strike-through state, or null when inherited. */
  readonly strike: boolean | null;
}

/** JSON-safe source details retained outside the first modeled subset. */
export interface WordParagraphPreservation {
  /** LitAST attributes not yet promoted to first-class fields. */
  readonly litAstAttrs?: Readonly<Record<string, unknown>> | null | undefined;
  /** Canonical tab state captured when the lossless LitAST attributes were imported. */
  readonly tabsSnapshot?: readonly WordParagraphTabStop[] | null | undefined;
  /** Canonical spacing captured when lossless LitAST attributes were imported. */
  readonly spacingSnapshot?: WordParagraphSpacing | null | undefined;
}

/** Word-compatible paragraph properties stored on one textblock node. */
export interface WordParagraphFormatting {
  /** Referenced Word paragraph style identifier, or null when inherited. */
  readonly styleId: string | null;
  /** Direct heading level 0–8, explicit body level 9, or null when style-owned. */
  readonly outlineLevel: number | null;
  /** Logical paragraph alignment, or null when inherited. */
  readonly alignment: WordParagraphAlignment | null;
  /** Explicit paragraph direction, or null when inherited. */
  readonly direction: WordParagraphDirection | null;
  /** Logical start/end and signed first-line indentation. */
  readonly indentation: WordParagraphIndentation;
  /** Explicit custom tab stops, or null when inherited/default tabs apply. */
  readonly tabs: readonly WordParagraphTabStop[] | null;
  /** Paragraph before/after and line spacing. */
  readonly spacing: WordParagraphSpacing;
  /** Page-boundary behavior with explicit false distinct from inheritance. */
  readonly pagination: WordParagraphPagination;
  /** Paragraph participation in the active section document grid. */
  readonly documentGrid: WordParagraphDocumentGrid;
  /** East Asian spacing and line-breaking switches. */
  readonly eastAsianLayout: WordParagraphEastAsianLayout;
  /** Paragraph border topology, or null when inherited. */
  readonly borders?: WordParagraphBorders | null | undefined;
  /** Paragraph shading, or null when inherited. */
  readonly shading?: WordParagraphShading | null | undefined;
  /** Direct paragraph-end mark formatting used by generated list markers. */
  readonly markFormatting?: WordParagraphMarkFormatting | null | undefined;
  /** Lossless source metadata outside the modeled subset. */
  readonly preservation: WordParagraphPreservation | null;
}

/** First-class Word paragraph fields accepted by the general patch command. */
export interface WordParagraphFormattingPatch {
  /** Paragraph style identifier update. */
  readonly styleId?: string | null | undefined;
  /** Direct heading level 0–8, body level 9, or null to restore style inheritance. */
  readonly outlineLevel?: number | null | undefined;
  /** Logical paragraph-alignment update. */
  readonly alignment?: WordParagraphAlignment | null | undefined;
  /** Explicit base-direction update. */
  readonly direction?: WordParagraphDirection | null | undefined;
  /** Complete logical indentation update. */
  readonly indentation?: WordParagraphIndentation | undefined;
  /** Complete explicit tab-stop update. */
  readonly tabs?: readonly WordParagraphTabStop[] | null | undefined;
  /** Complete paragraph-spacing update. */
  readonly spacing?: WordParagraphSpacing | undefined;
  /** Complete page-boundary behavior update. */
  readonly pagination?: WordParagraphPagination | undefined;
  /** Per-field grid update; omitted switches retain each paragraph's values. */
  readonly documentGrid?: Partial<WordParagraphDocumentGrid> | undefined;
  /** Per-field East Asian layout update; omitted switches retain each paragraph's values. */
  readonly eastAsianLayout?: Partial<WordParagraphEastAsianLayout> | undefined;
  /** Complete paragraph border topology update. */
  readonly borders?: WordParagraphBorders | null | undefined;
  /** Complete paragraph shading update. */
  readonly shading?: WordParagraphShading | null | undefined;
  /** Complete paragraph-end mark formatting update. */
  readonly markFormatting?: WordParagraphMarkFormatting | null | undefined;
}

/** Paragraph indentation resolved into physical-independent twip distances. */
export interface ResolvedWordParagraphIndentation {
  /** Logical start inset in twips. */
  readonly startTwips: number;
  /** Logical end inset in twips. */
  readonly endTwips: number;
  /** Signed first-line delta in twips. */
  readonly firstLineTwips: number;
}

/** Active selection paragraph context projected without product UI. */
export interface WordParagraphSelectionContext {
  /** Formatting from the selection head paragraph. */
  readonly formatting: WordParagraphFormatting;
  /**
   * Source-ordered formatting for every covered paragraph.
   *
   * Product controls can project one field from this collection so an
   * unrelated paragraph difference does not incorrectly produce a mixed
   * state.
   */
  readonly formattingValues: readonly WordParagraphFormatting[];
  /** Head-paragraph indentation resolved using the supplied character pitch. */
  readonly indentation: ResolvedWordParagraphIndentation;
  /** Whether covered textblocks have different paragraph formatting. */
  readonly mixed: boolean;
  /** Number of covered paragraph textblocks. */
  readonly paragraphCount: number;
  /** Logical base direction declared by the head paragraph. */
  readonly direction: "ltr" | "rtl" | "auto";
}
