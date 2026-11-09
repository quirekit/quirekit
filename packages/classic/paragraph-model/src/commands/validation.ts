import { isEastAsianLayoutPatch } from "./east-asian";
import type {
  WordParagraphDxaMeasurement,
  WordParagraphDocumentGrid,
  WordParagraphEastAsianLayout,
  WordParagraphFormattingPatch,
  WordParagraphIndentation,
  WordParagraphLineSpacing,
  WordParagraphMeasurement,
  WordParagraphPagination,
  WordParagraphSpacing
} from "../types";
import type {
  SetWordParagraphPropertiesOptions,
  SetWordParagraphIndentationOptions,
  SetWordParagraphLineSpacingOptions,
  SetWordParagraphSpacingOptions
} from "./types";

/**
 * Validates the general Word paragraph property-patch command.
 *
 * @param value - Candidate command argument.
 * @returns Whether every present field follows the canonical paragraph model.
 */
export function isSetWordParagraphPropertiesOptions(
  value: unknown
): value is SetWordParagraphPropertiesOptions {
  if (!isRecord(value) || !isRecord(value.properties)) return false;
  const properties = value.properties as WordParagraphFormattingPatch;
  return isOptionalStyleId(properties.styleId)
    && isOptionalOutlineLevel(properties.outlineLevel)
    && isOptionalAlignment(properties.alignment)
    && isOptionalDirection(properties.direction)
    && (
      properties.indentation === undefined
      || isSetWordParagraphIndentationOptions({
        indentation: properties.indentation
      })
    )
    && (
      properties.tabs === undefined
      || properties.tabs === null
      || (
        Array.isArray(properties.tabs)
        && properties.tabs.every(isTabStop)
      )
    )
    && (
      properties.spacing === undefined
      || isSetWordParagraphSpacingOptions({ spacing: properties.spacing })
    )
    && isOptionalNullableBooleanRecord(
      properties.pagination,
      ["widowControl", "keepNext", "keepLines", "pageBreakBefore"]
    )
    && isDocumentGridPatch(properties.documentGrid)
    && isEastAsianLayoutPatch(properties.eastAsianLayout);
}

/** @param value - Requested grid switches. @returns Whether only known nullable boolean fields are present. */
function isDocumentGridPatch(value: unknown): boolean {
  return value === undefined || isRecord(value) && Object.entries(value).every(([key, field]) =>
    (key === "adjustRightIndent" || key === "snapToGrid") && (field === null || typeof field === "boolean"));
}

/**
 * Validates paragraph indentation command input before mutating editor state.
 *
 * @param value - Candidate command argument.
 * @returns Whether the complete indentation target is valid.
 */
export function isSetWordParagraphIndentationOptions(
  value: unknown
): value is SetWordParagraphIndentationOptions {
  if (!isRecord(value) || !isRecord(value.indentation)) return false;
  const indentation = value.indentation as Partial<WordParagraphIndentation>;
  return isOptionalMeasurement(indentation.start)
    && isOptionalMeasurement(indentation.end)
    && isOptionalMeasurement(indentation.firstLine);
}

/**
 * Validates a complete paragraph-spacing command argument.
 *
 * @param value - Candidate command argument.
 * @returns Whether before, after, and line fields are canonical.
 */
export function isSetWordParagraphSpacingOptions(
  value: unknown
): value is SetWordParagraphSpacingOptions {
  if (!isRecord(value) || !isRecord(value.spacing)) return false;
  const spacing = value.spacing as Partial<WordParagraphSpacing>;
  return isOptionalDxaMeasurement(spacing.before)
    && isOptionalLineUnitSpacing(spacing.beforeLines)
    && isOptionalBoolean(spacing.beforeAutoSpacing)
    && isOptionalDxaMeasurement(spacing.after)
    && isOptionalLineUnitSpacing(spacing.afterLines)
    && isOptionalBoolean(spacing.afterAutoSpacing)
    && isOptionalLineSpacing(spacing.line);
}

/**
 * Checks nullable paragraph spacing in hundredths of one line.
 *
 * @param value - Candidate line-unit spacing.
 * @returns Whether the value is a non-negative integer or inherited null.
 */
function isOptionalLineUnitSpacing(value: unknown): value is number | null {
  return value === null || (
    typeof value === "number"
    && Number.isInteger(value)
    && value >= 0
  );
}

/**
 * Checks one nullable boolean spacing switch.
 *
 * @param value - Candidate automatic-spacing switch.
 * @returns Whether the value is boolean or inherited null.
 */
function isOptionalBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

/**
 * Validates a line-only paragraph-spacing command argument.
 *
 * @param value - Candidate command argument.
 * @returns Whether the line field is canonical or explicitly inherited.
 */
export function isSetWordParagraphLineSpacingOptions(
  value: unknown
): value is SetWordParagraphLineSpacingOptions {
  return isRecord(value) && isOptionalLineSpacing(value.line);
}

/**
 * Checks a nullable retained measurement.
 *
 * @param value - Candidate absolute or character-relative measurement.
 * @returns Whether the measurement is valid or inherited.
 */
function isOptionalMeasurement(
  value: unknown
): value is WordParagraphMeasurement | null {
  if (value === null) return true;
  if (!isRecord(value) || !Number.isInteger(value.value)) return false;
  return value.unit === "dxa" || value.unit === "character";
}

/**
 * Checks nullable twip paragraph spacing.
 *
 * @param value - Candidate before/after value.
 * @returns Whether the value is an integer twip measurement or null.
 */
function isOptionalDxaMeasurement(
  value: unknown
): value is WordParagraphDxaMeasurement | null {
  return value === null || (
    isRecord(value)
    && value.unit === "dxa"
    && typeof value.value === "number"
    && Number.isInteger(value.value)
    && value.value >= 0
  );
}

/**
 * Checks nullable typed line spacing.
 *
 * @param value - Candidate line spacing.
 * @returns Whether the rule and positive integer value are valid or inherited.
 */
function isOptionalLineSpacing(
  value: unknown
): value is WordParagraphLineSpacing | null {
  return value === null || (
    isRecord(value)
    && (
      value.rule === "auto"
      || value.rule === "exact"
      || value.rule === "atLeast"
    )
    && typeof value.value === "number"
    && Number.isInteger(value.value)
    && value.value > 0
  );
}

/**
 * Checks an optional paragraph style identifier.
 *
 * @param value - Candidate style identifier.
 * @returns Whether the value is absent, inherited, or a non-empty identifier.
 */
function isOptionalStyleId(
  value: unknown
): value is string | null | undefined {
  return value === undefined
    || value === null
    || (typeof value === "string" && value.length > 0);
}

/**
 * Checks an optional zero-based Word outline level.
 *
 * @param value - Candidate outline level.
 * @returns Whether the value is inherited, a heading level 0–8, or explicit body level 9.
 */
function isOptionalOutlineLevel(
  value: unknown
): value is number | null | undefined {
  return value === undefined
    || value === null
    || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 9);
}

/**
 * Checks an optional logical paragraph alignment.
 *
 * @param value - Candidate alignment.
 * @returns Whether the value is absent, inherited, or supported.
 */
function isOptionalAlignment(
  value: unknown
): value is WordParagraphFormattingPatch["alignment"] {
  return value === undefined
    || value === null
    || value === "start"
    || value === "center"
    || value === "end"
    || value === "justify"
    || value === "distribute";
}

/**
 * Checks an optional explicit base direction.
 *
 * @param value - Candidate direction.
 * @returns Whether the value is absent, inherited, left-to-right, or right-to-left.
 */
function isOptionalDirection(
  value: unknown
): value is WordParagraphFormattingPatch["direction"] {
  return value === undefined
    || value === null
    || value === "ltr"
    || value === "rtl";
}

/**
 * Checks a complete explicit tab stop.
 *
 * @param value - Candidate tab stop.
 * @returns Whether position, alignment, and optional leader are canonical.
 */
function isTabStop(value: unknown): boolean {
  if (!isRecord(value) || !isOptionalMeasurement(value.position)) return false;
  if (value.position === null || value.position === undefined) return false;
  const alignmentValid = value.alignment === "start"
    || value.alignment === "center"
    || value.alignment === "end"
    || value.alignment === "decimal"
    || value.alignment === "bar"
    || value.alignment === "num"
    || value.alignment === "clear";
  return alignmentValid
    && (
      value.leader === undefined
      || value.leader === null
      || typeof value.leader === "string"
    );
}

/**
 * Checks one optional record whose known fields are nullable booleans.
 *
 * @param value - Candidate record.
 * @param keys - Required canonical field names when the record is present.
 * @returns Whether the record is absent or contains all valid fields.
 */
function isOptionalNullableBooleanRecord(
  value: unknown,
  keys: readonly string[]
): value is
  | WordParagraphPagination
  | WordParagraphDocumentGrid
  | WordParagraphEastAsianLayout
  | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return keys.every((key) => (
    value[key] === null || typeof value[key] === "boolean"
  ));
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
