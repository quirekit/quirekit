import type {
  ResolvedWordParagraphIndentation,
  WordParagraphCharacterMeasurement,
  WordParagraphDxaMeasurement,
  WordParagraphFormatting,
  WordParagraphIndentation,
  WordParagraphLineSpacing,
  WordParagraphMeasurement
} from "../types";
import {
  resolveWordParagraphBorders,
  resolveWordParagraphShading
} from "../conversion/decorations";
import { resolveWordParagraphMarkFormatting } from "../conversion/mark-formatting";

/** Default character pitch used until section document-grid resolution is connected. */
export const defaultWordParagraphCharacterPitchTwips = 240;

/** Default inherited Word paragraph formatting. */
export const defaultWordParagraphFormatting: WordParagraphFormatting = Object.freeze({
  styleId: null,
  outlineLevel: null,
  alignment: null,
  direction: null,
  indentation: Object.freeze({ start: null, end: null, firstLine: null }),
  tabs: null,
  spacing: Object.freeze({
    before: null,
    beforeLines: null,
    beforeAutoSpacing: null,
    after: null,
    afterLines: null,
    afterAutoSpacing: null,
    line: null
  }),
  pagination: Object.freeze({
    widowControl: null,
    keepNext: null,
    keepLines: null,
    pageBreakBefore: null
  }),
  documentGrid: Object.freeze({
    adjustRightIndent: null,
    snapToGrid: null
  }),
  eastAsianLayout: Object.freeze({
    autoSpaceLatin: null,
    autoSpaceNumber: null,
    wordWrap: null,
    kinsoku: null,
    overflowPunctuation: null,
    compressLineStartPunctuation: null
  }),
  borders: null,
  shading: null,
  markFormatting: null,
  preservation: null
});

/**
 * Creates one absolute paragraph measurement.
 *
 * @param value - Signed distance in twentieths of a point.
 * @returns Absolute paragraph measurement.
 */
export function createWordParagraphDxaMeasurement(
  value: number
): WordParagraphDxaMeasurement {
  return { unit: "dxa", value: Math.round(value) };
}

/**
 * Creates one relative paragraph measurement.
 *
 * @param value - Signed distance in hundredths of one character.
 * @returns Character-relative paragraph measurement.
 */
export function createWordParagraphCharacterMeasurement(
  value: number
): WordParagraphCharacterMeasurement {
  return { unit: "character", value: Math.round(value) };
}

/**
 * Converts a retained paragraph measurement into twips for layout projection.
 *
 * @param measurement - Absolute or character-relative measurement.
 * @param characterPitchTwips - Effective character pitch in twips.
 * @returns Signed distance in twips.
 */
export function wordParagraphMeasurementToTwips(
  measurement: WordParagraphMeasurement | null,
  characterPitchTwips = defaultWordParagraphCharacterPitchTwips
): number {
  if (measurement === null) return 0;
  return measurement.unit === "dxa"
    ? measurement.value
    : measurement.value / 100 * characterPitchTwips;
}

/**
 * Resolves unknown node attrs into the canonical paragraph formatting contract.
 *
 * @param value - Candidate `wordParagraph` node attribute.
 * @returns Valid formatting or the inherited default.
 */
export function resolveWordParagraphFormatting(
  value: unknown
): WordParagraphFormatting {
  if (!isRecord(value)) return defaultWordParagraphFormatting;
  const styleId = typeof value.styleId === "string" && value.styleId.length > 0
    ? value.styleId
    : null;
  const outlineLevel = Number.isInteger(value.outlineLevel)
    && Number(value.outlineLevel) >= 0
    && Number(value.outlineLevel) <= 9
    ? Number(value.outlineLevel)
    : null;
  const alignment = isParagraphAlignment(value.alignment)
    ? value.alignment
    : null;
  const direction = value.direction === "ltr" || value.direction === "rtl"
    ? value.direction
    : null;
  const indentation = resolveRetainedIndentation(value.indentation);
  const tabs = Array.isArray(value.tabs)
    ? value.tabs.filter(isTabStop)
    : null;
  const spacing = resolveRetainedSpacing(value.spacing);
  const pagination = resolveNullableBooleanRecord(
    value.pagination,
    defaultWordParagraphFormatting.pagination
  );
  const documentGrid = resolveNullableBooleanRecord(
    value.documentGrid,
    defaultWordParagraphFormatting.documentGrid
  );
  const eastAsianLayout = resolveNullableBooleanRecord(
    value.eastAsianLayout,
    defaultWordParagraphFormatting.eastAsianLayout
  );
  const preservation = isRecord(value.preservation)
    ? value.preservation
    : null;
  const borders = resolveWordParagraphBorders(value.borders);
  const shading = resolveWordParagraphShading(value.shading);
  const markFormatting = resolveWordParagraphMarkFormatting(
    value.markFormatting
  );
  return {
    styleId,
    outlineLevel,
    alignment,
    direction,
    indentation,
    tabs,
    spacing,
    pagination,
    documentGrid,
    eastAsianLayout,
    borders,
    shading,
    markFormatting,
    preservation
  };
}

/**
 * Resolves retained indentation into twips for View and ruler geometry.
 *
 * @param indentation - Canonical retained paragraph indentation.
 * @param characterPitchTwips - Effective character pitch in twips.
 * @returns Logical start/end and signed first-line twip values.
 */
export function resolveWordParagraphIndentation(
  indentation: WordParagraphIndentation,
  characterPitchTwips = defaultWordParagraphCharacterPitchTwips
): ResolvedWordParagraphIndentation {
  return {
    startTwips: wordParagraphMeasurementToTwips(
      indentation.start,
      characterPitchTwips
    ),
    endTwips: wordParagraphMeasurementToTwips(
      indentation.end,
      characterPitchTwips
    ),
    firstLineTwips: wordParagraphMeasurementToTwips(
      indentation.firstLine,
      characterPitchTwips
    )
  };
}

/**
 * Resolves one retained indentation object without accepting malformed units.
 *
 * @param value - Candidate indentation value.
 * @returns Canonical indentation with invalid fields reset to inherited zero.
 */
function resolveRetainedIndentation(value: unknown): WordParagraphIndentation {
  if (!isRecord(value)) return defaultWordParagraphFormatting.indentation;
  return {
    start: isMeasurement(value.start) ? value.start : null,
    end: isMeasurement(value.end) ? value.end : null,
    firstLine: isMeasurement(value.firstLine) ? value.firstLine : null
  };
}

/**
 * Checks one absolute or relative paragraph measurement.
 *
 * @param value - Candidate measurement.
 * @returns Whether the unit and integer value are valid.
 */
function isMeasurement(value: unknown): value is WordParagraphMeasurement {
  if (!isRecord(value) || !Number.isInteger(value.value)) return false;
  return value.unit === "dxa" || value.unit === "character";
}

/**
 * Checks one future tab-stop record while keeping malformed imports isolated.
 *
 * @param value - Candidate tab stop.
 * @returns Whether the first-class tab fields are valid.
 */
function isTabStop(
  value: unknown
): value is NonNullable<WordParagraphFormatting["tabs"]>[number] {
  if (!isRecord(value) || !isMeasurement(value.position)) return false;
  return value.alignment === "start"
    || value.alignment === "center"
    || value.alignment === "end"
    || value.alignment === "decimal"
    || value.alignment === "bar"
    || value.alignment === "num"
    || value.alignment === "clear";
}

/**
 * Resolves paragraph-owned spacing without accepting ambiguous CSS values.
 *
 * @param value - Candidate spacing record.
 * @returns Canonical paragraph spacing with invalid fields reset to inherited.
 */
function resolveRetainedSpacing(
  value: unknown
): WordParagraphFormatting["spacing"] {
  if (!isRecord(value)) return defaultWordParagraphFormatting.spacing;
  return {
    before: isDxaMeasurement(value.before) ? value.before : null,
    beforeLines: isLineUnitSpacing(value.beforeLines) ? value.beforeLines : null,
    beforeAutoSpacing: typeof value.beforeAutoSpacing === "boolean"
      ? value.beforeAutoSpacing
      : null,
    after: isDxaMeasurement(value.after) ? value.after : null,
    afterLines: isLineUnitSpacing(value.afterLines) ? value.afterLines : null,
    afterAutoSpacing: typeof value.afterAutoSpacing === "boolean"
      ? value.afterAutoSpacing
      : null,
    line: isLineSpacing(value.line) ? value.line : null
  };
}

/**
 * Checks one paragraph distance expressed in hundredths of a line.
 *
 * @param value - Candidate line-unit spacing value.
 * @returns Whether the value is a non-negative integer.
 */
function isLineUnitSpacing(value: unknown): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 0;
}

/**
 * Checks an absolute paragraph distance.
 *
 * @param value - Candidate before/after spacing.
 * @returns Whether the value is an integer twip measurement.
 */
function isDxaMeasurement(
  value: unknown
): value is WordParagraphDxaMeasurement {
  return isRecord(value)
    && value.unit === "dxa"
    && typeof value.value === "number"
    && Number.isInteger(value.value)
    && value.value >= 0;
}

/**
 * Checks a typed line-spacing rule and positive OOXML integer value.
 *
 * @param value - Candidate line spacing.
 * @returns Whether the value follows the canonical rule/unit contract.
 */
function isLineSpacing(value: unknown): value is WordParagraphLineSpacing {
  return isRecord(value)
    && (
      value.rule === "auto"
      || value.rule === "exact"
      || value.rule === "atLeast"
    )
    && typeof value.value === "number"
    && Number.isInteger(value.value)
    && value.value > 0;
}

/**
 * Checks one logical Word paragraph alignment.
 *
 * @param value - Candidate alignment.
 * @returns Whether the value is a supported logical alignment.
 */
function isParagraphAlignment(
  value: unknown
): value is WordParagraphFormatting["alignment"] {
  return value === "start"
    || value === "center"
    || value === "end"
    || value === "justify"
    || value === "distribute";
}

/**
 * Resolves a record whose fields distinguish inheritance from explicit false.
 *
 * @param value - Candidate record.
 * @param fallback - Canonical record that supplies the expected field names.
 * @returns A sanitized record with invalid fields reset to null.
 */
function resolveNullableBooleanRecord<T extends object>(
  value: unknown,
  fallback: T
): T {
  if (!isRecord(value)) return fallback;
  const result: Record<string, boolean | null> = {};
  for (const key of Object.keys(fallback)) {
    const candidate = value[key];
    result[key] = typeof candidate === "boolean" ? candidate : null;
  }
  return result as T;
}

/**
 * Checks a non-array object before property access.
 *
 * @param value - Candidate object.
 * @returns Whether the value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
