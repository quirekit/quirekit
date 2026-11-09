import { projectWordParagraphTabs } from "./tabs";
import { wordExactLineBaselineRatio } from "../model/spacing";
import type {
  WordParagraphBorder,
  WordParagraphFormatting,
  WordParagraphMarkFormatting,
  WordParagraphMeasurement
} from "../types";
import type {
  WordParagraphModelBorder,
  WordParagraphModelFormatting,
  WordParagraphModelMarkTypography
} from "./types";

const cssPixelsPerPoint = 96 / 72;
const supportedParagraphBorderStyles = new Set([
  "single", "thick", "double", "dotted", "dashSmallGap", "dashed", "dotDash", "dotDotDash"
]);

/**
 * Projects effective Word paragraph formatting into layout-ready values.
 *
 * Word unit conversions (points, eighths of a point) and file-format defaults
 * such as enabled widow control happen here, so a layout engine receives CSS
 * pixels and neutral policies only.
 *
 * @param formatting - Effective paragraph formatting after style resolution.
 * @param direct - Whether the paragraph node carries direct Word formatting.
 * @param defaultTabInterval - Effective document interval for literal-tab paragraphs, in twips.
 * @returns Layout projection carrying the formatting as its token.
 */
export function projectWordParagraphLayoutFormatting(
  formatting: WordParagraphFormatting,
  direct: boolean,
  defaultTabInterval?: number
): WordParagraphModelFormatting {
  const line = formatting.spacing.line;
  const tabs = projectWordParagraphTabs(formatting, defaultTabInterval);
  return {
    token: formatting,
    signature: createWordParagraphLayoutSignature(formatting) + (tabs?.defaultInterval === undefined ? '' : `|default-tab:${tabs.defaultInterval}`),
    indentation: formatting.indentation,
    tabs,
    autoSpacing: {
      ideographAlpha: formatting.eastAsianLayout.autoSpaceLatin === false ? 0 : 0.25,
      ideographNumeric: formatting.eastAsianLayout.autoSpaceNumber === false ? 0 : 0.25
    },
    avoidPunctuationBreaks: formatting.eastAsianLayout.kinsoku !== false,
    alignment: formatting.alignment,
    direction: formatting.direction,
    snapToGrid: formatting.documentGrid.snapToGrid,
    lineSpacing: line === null ? null : {
      mode: line.rule === "exact" ? "exact" : line.rule === "atLeast" ? "at-least" : "multiple",
      value: line.value / (line.rule === "auto" ? 240 : 15),
      ...(line.rule === "exact" ? { exactBaselineRatio: wordExactLineBaselineRatio } : {})
    },
    naturalLineMetrics: direct || line !== null,
    pagination: projectPagination(formatting.pagination),
    markTypography: projectMarkTypography(formatting.markFormatting ?? null),
    decoration: projectDecoration(formatting)
  };
}

/**
 * Creates stable cache identity from the effective layout-affecting fields.
 *
 * @param formatting - Effective canonical paragraph formatting.
 * @returns Deterministic JSON-safe signature for retained measurement caches.
 */
export function createWordParagraphLayoutSignature(formatting: WordParagraphFormatting): string {
  return JSON.stringify([
    formatting.alignment,
    formatting.direction,
    measurementSignature(formatting.indentation.start),
    measurementSignature(formatting.indentation.end),
    measurementSignature(formatting.indentation.firstLine),
    formatting.tabs,
    measurementSignature(formatting.spacing.before),
    formatting.spacing.beforeLines,
    formatting.spacing.beforeAutoSpacing,
    measurementSignature(formatting.spacing.after),
    formatting.spacing.afterLines,
    formatting.spacing.afterAutoSpacing,
    formatting.spacing.line?.rule ?? null,
    formatting.spacing.line?.value ?? null,
    formatting.pagination.widowControl,
    formatting.pagination.keepNext,
    formatting.pagination.keepLines,
    formatting.pagination.pageBreakBefore,
    formatting.documentGrid.adjustRightIndent,
    formatting.documentGrid.snapToGrid,
    formatting.eastAsianLayout.autoSpaceLatin,
    formatting.eastAsianLayout.autoSpaceNumber,
    formatting.eastAsianLayout.wordWrap,
    formatting.eastAsianLayout.kinsoku,
    formatting.eastAsianLayout.overflowPunctuation,
    formatting.eastAsianLayout.compressLineStartPunctuation,
    formatting.borders ?? null,
    formatting.shading ?? null,
    formatting.markFormatting ?? null
  ]);
}

/**
 * Projects one optional paragraph measurement into primitive cache identity.
 *
 * @param measurement - Canonical absolute or character-relative measurement.
 * @returns Stable unit/value pair, or null for inheritance.
 */
function measurementSignature(
  measurement: WordParagraphMeasurement | null
): readonly [WordParagraphMeasurement["unit"], number] | null {
  return measurement === null ? null : [measurement.unit, measurement.value];
}

/**
 * Compiles Word pagination flags into a block pagination policy.
 *
 * OOXML enables widow and orphan control unless a direct or inherited value
 * turns it off, so the effective default is applied here.
 *
 * @param pagination - Effective pagination flags.
 * @returns Neutral block pagination policy.
 */
function projectPagination(pagination: WordParagraphFormatting["pagination"]): WordParagraphModelFormatting["pagination"] {
  if (pagination === null) return { widows: 2, orphans: 2 };
  const widows = pagination.widowControl === false ? 1 : 2;
  return {
    ...(pagination.pageBreakBefore === true ? { breakBefore: "page" as const } : {}),
    ...(pagination.keepLines === true ? { keepTogether: true } : {}),
    ...(pagination.keepNext === true ? { keepWithNext: true } : {}),
    widows,
    orphans: widows
  };
}

/**
 * Converts paragraph-mark formatting into CSS typography.
 *
 * @param formatting - Paragraph-mark formatting, when present.
 * @returns Typography with the font size in CSS pixels, or null.
 */
function projectMarkTypography(formatting: WordParagraphMarkFormatting | null): WordParagraphModelMarkTypography | null {
  if (formatting === null) return null;
  return {
    bold: formatting.bold,
    italic: formatting.italic,
    fontSize: formatting.fontSizePt === null ? null : formatting.fontSizePt * 96 / 72,
    fontFamily: formatting.fontFamily,
    underline: formatting.underline,
    strike: formatting.strike,
    color: formatting.color === null || formatting.color === "auto" ? null : formatting.color
  };
}

/**
 * Converts shading and borders into logical decoration in CSS pixels.
 *
 * @param formatting - Effective paragraph formatting.
 * @returns Decoration, or null when the paragraph has no visible shading or border.
 */
function projectDecoration(formatting: WordParagraphFormatting): WordParagraphModelFormatting["decoration"] {
  const borders = formatting.borders ?? null;
  const shading = formatting.shading ?? null;
  const fill = shading?.fill === null || shading?.fill === "auto" ? undefined : shading?.fill;
  const top = compileBorder(borders?.top ?? null);
  const bottom = compileBorder(borders?.bottom ?? null);
  const start = compileBorder(borders?.start ?? null);
  const end = compileBorder(borders?.end ?? null);
  if (fill === undefined && top === undefined && bottom === undefined && start === undefined && end === undefined) {
    return null;
  }
  return {
    // Word decorations extend beyond the text indentation interval; this is
    // independent of border space and must not reduce the wrapping width.
    inlineOutset: 96 / 25.4 / 2,
    ...(fill === undefined ? {} : { fill }),
    ...(top === undefined ? {} : { top }),
    ...(bottom === undefined ? {} : { bottom }),
    ...(start === undefined ? {} : { start }),
    ...(end === undefined ? {} : { end })
  };
}

/**
 * Converts one canonical Word border side into CSS pixels.
 *
 * @param value - Canonical border side.
 * @returns Border side, or undefined for absent, none, or unsupported styles.
 */
function compileBorder(value: WordParagraphBorder | null): WordParagraphModelBorder | undefined {
  if (value === null || value.style === "none" || value.style === "nil" || !supportedParagraphBorderStyles.has(value.style)) {
    return undefined;
  }
  return {
    style: value.style,
    ...(value.color === null || value.color === "auto" ? {} : { strokeStyle: value.color }),
    lineWidth: Math.max(1 / 8 * cssPixelsPerPoint, (value.sizeEighthPoints ?? 4) / 8 * cssPixelsPerPoint),
    space: (value.spacePoints ?? 0) * cssPixelsPerPoint
  };
}
