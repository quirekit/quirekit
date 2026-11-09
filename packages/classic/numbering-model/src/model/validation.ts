import type {
  WordAbstractNumbering,
  WordListKind,
  WordNumberingInstance,
  WordNumberingLevel,
  WordNumberingLanguage,
  WordNumberingMarkerFonts,
  WordNumberingMarkerStyle,
  WordNumberingMarkerThemeFont,
  WordNumberingRegistry,
  WordParagraphNumbering,
  WordParagraphNumberingSuppression
} from "../types";
import { isWordNumberingFormat } from "./formats";

const listKinds = new Set<WordListKind>(["ordered", "bullet", "task"]);

/**
 * Checks the complete document registry shape before it becomes authority.
 *
 * @param value - Candidate persisted registry.
 * @returns Whether definitions, instances, and ids are valid.
 */
export function isWordNumberingRegistry(value: unknown): value is WordNumberingRegistry {
  if (!isRecord(value)) return false;
  const abstractNums = value.abstractNums;
  const nums = value.nums;
  if (!isRecord(abstractNums) || !isRecord(nums)) {
    return false;
  }
  if (!Number.isInteger(value.nextInstanceId) || Number(value.nextInstanceId) < 1) {
    return false;
  }
  return Object.entries(abstractNums).every(([id, definition]) =>
    isWordAbstractNumbering(definition) && definition.id === id
  ) && Object.entries(nums).every(([id, instance]) =>
    isNumberingInstance(instance)
    && instance.id === id
    && abstractNums[instance.abstractNumId] !== undefined
  );
}

/** Canonical `wordNumbering` value for a paragraph that opts out of style numbering. */
export const wordParagraphNumberingSuppression: WordParagraphNumberingSuppression = "none";

/**
 * Checks whether a paragraph explicitly removes inherited style numbering.
 *
 * @param value - Candidate `wordNumbering` node attr.
 * @returns Whether the value is the suppression marker.
 */
export function isWordParagraphNumberingSuppressed(
  value: unknown
): value is WordParagraphNumberingSuppression {
  return value === wordParagraphNumberingSuppression;
}

/**
 * Resolves one direct paragraph numbering reference.
 *
 * @param value - Candidate `wordNumbering` attribute.
 * @returns Valid reference, or null for unnumbered, suppressed or malformed values.
 */
export function resolveWordParagraphNumbering(
  value: unknown
): WordParagraphNumbering | null {
  if (!isRecord(value) || typeof value.numId !== "string") return null;
  if (!Number.isInteger(value.level) || Number(value.level) < 0 || Number(value.level) > 8) {
    return null;
  }
  const startOverride = value.startOverride;
  if (startOverride !== null && (
    !Number.isInteger(startOverride) || Number(startOverride) < 0
  )) return null;
  const task = value.task;
  if (task !== null && (!isRecord(task) || typeof task.checked !== "boolean")) {
    return null;
  }
  return {
    numId: value.numId,
    level: Number(value.level),
    startOverride: startOverride === null ? null : Number(startOverride),
    task: task === null ? null : { checked: task.checked as boolean }
  };
}

/**
 * Checks one complete canonical abstract numbering definition.
 *
 * @param value - Candidate abstract numbering record.
 * @returns Whether the definition and every declared level are valid.
 */
export function isWordAbstractNumbering(
  value: unknown
): value is WordAbstractNumbering {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.kind === "string"
    && listKinds.has(value.kind as WordListKind)
    && isOptionalNonEmptyString(value.styleLink)
    && isOptionalNonEmptyString(value.numStyleLink)
    && (value.resolvedNumStyleLink === undefined || typeof value.resolvedNumStyleLink === "boolean")
    && isRecord(value.levels)
    && Object.entries(value.levels).every(([index, level]) =>
      isWordNumberingLevel(level) && String(level.level) === index
    );
}

/**
 * Checks one canonical numbering level over the admitted field set.
 *
 * @param value - Candidate numbering level.
 * @returns Whether all canonical fields are valid.
 */
export function isWordNumberingLevel(
  value: unknown
): value is WordNumberingLevel {
  return isRecord(value)
    && Number.isInteger(value.level)
    && Number(value.level) >= 0
    && Number(value.level) <= 8
    && isWordNumberingFormat(value.format)
    && (
      value.customFormat === undefined
      || (
        value.format === "custom"
        && typeof value.customFormat === "string"
        && value.customFormat.trim().length > 0
      )
    )
    && typeof value.text === "string"
    && Number.isInteger(value.start)
    && Number(value.start) >= 0
    && isLevelRestart(value.restartAfterLevel, Number(value.level))
    && (value.suffix === "tab" || value.suffix === "space" || value.suffix === "nothing")
    && (value.justification === "start" || value.justification === "center" || value.justification === "end")
    && isParagraphIndentation(value.paragraphIndentation)
    && isOptionalBoolean(value.isLegal)
    && isOptionalNonEmptyString(value.paragraphStyleId)
    && (value.paragraphTabs === undefined || (Array.isArray(value.paragraphTabs) && value.paragraphTabs.every(isTabStop)))
    && (value.markerStyle === undefined || isMarkerStyle(value.markerStyle));
}

/**
 * Validates one admitted numbering-marker style delta.
 *
 * @param value - Candidate marker style.
 * @returns Whether every present field has canonical semantics.
 */
function isMarkerStyle(value: unknown): value is WordNumberingMarkerStyle {
  if (!isRecord(value)) return false;
  return (value.fonts === undefined || isMarkerFonts(value.fonts))
    && (value.language === undefined || isMarkerLanguage(value.language))
    && (
      value.fontSizePt === undefined
      || (
        typeof value.fontSizePt === "number"
        && Number.isFinite(value.fontSizePt)
        && value.fontSizePt > 0
        && Number.isInteger(value.fontSizePt * 2)
      )
    )
    && (
      value.complexScriptFontSizePt === undefined
      || (
        typeof value.complexScriptFontSizePt === "number"
        && Number.isFinite(value.complexScriptFontSizePt)
        && value.complexScriptFontSizePt > 0
        && Number.isInteger(value.complexScriptFontSizePt * 2)
      )
    )
    && isOptionalBoolean(value.bold)
    && isOptionalBoolean(value.complexScriptBold)
    && isOptionalBoolean(value.italic)
    && isOptionalBoolean(value.complexScriptItalic)
    && isOptionalBoolean(value.underline)
    && isOptionalBoolean(value.strike)
    && (
      value.color === undefined
      || value.color === "auto"
      || (typeof value.color === "string" && /^#[0-9A-F]{6}$/iu.test(value.color))
    );
}

/**
 * Validates explicit marker language slots.
 *
 * @param value - Candidate language-slot record.
 * @returns Whether every present language is non-empty.
 */
function isMarkerLanguage(value: unknown): value is WordNumberingLanguage {
  if (!isRecord(value)) return false;
  return isOptionalNonEmptyString(value.value)
    && isOptionalNonEmptyString(value.eastAsia)
    && isOptionalNonEmptyString(value.bidi);
}

/**
 * Validates explicit marker font slots.
 *
 * @param value - Candidate font-slot record.
 * @returns Whether every present font and hint is valid.
 */
function isMarkerFonts(value: unknown): value is WordNumberingMarkerFonts {
  if (!isRecord(value)) return false;
  return isOptionalNonEmptyString(value.ascii)
    && isOptionalNonEmptyString(value.highAnsi)
    && isOptionalNonEmptyString(value.eastAsia)
    && isOptionalNonEmptyString(value.complexScript)
    && isOptionalMarkerThemeFont(value.asciiTheme)
    && isOptionalMarkerThemeFont(value.highAnsiTheme)
    && isOptionalMarkerThemeFont(value.eastAsiaTheme)
    && isOptionalMarkerThemeFont(value.complexScriptTheme)
    && (
      value.hint === undefined
      || value.hint === "default"
      || value.hint === "eastAsia"
      || value.hint === "cs"
    );
}

/**
 * Validates one optional OOXML theme-font token.
 *
 * @param value - Candidate theme-font reference.
 * @returns Whether the value is omitted or belongs to the complete ST_Theme set.
 */
function isOptionalMarkerThemeFont(
  value: unknown
): value is WordNumberingMarkerThemeFont | undefined {
  return value === undefined
    || value === "majorAscii"
    || value === "majorBidi"
    || value === "majorEastAsia"
    || value === "majorHAnsi"
    || value === "minorAscii"
    || value === "minorBidi"
    || value === "minorEastAsia"
    || value === "minorHAnsi";
}

/** @param value - Candidate optional boolean. @returns Whether the value is omitted or boolean. */
function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

/** @param value - Candidate optional font family. @returns Whether it is omitted or non-empty. */
function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.trim().length > 0);
}

/**
 * Validates the OOXML level-restart projection.
 *
 * @param value - Candidate zero-based restart trigger.
 * @param level - Zero-based level that owns the rule.
 * @returns Whether the trigger is omitted, never, or a valid ancestor.
 */
function isLevelRestart(value: unknown, level: number): boolean {
  return value === undefined
    || value === null
    || (Number.isInteger(value) && Number(value) >= 0 && Number(value) < level);
}

/** @param value - Candidate concrete numbering instance. @returns Whether its ids are valid. */
function isNumberingInstance(value: unknown): value is WordNumberingInstance {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.abstractNumId === "string";
}

/** @param value - Candidate paragraph indentation. @returns Whether its measurement fields are retained shapes. */
function isParagraphIndentation(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isMeasurementOrNull(value.start)
    && isMeasurementOrNull(value.end)
    && isMeasurementOrNull(value.firstLine);
}

/** @param value - Candidate nullable measurement. @returns Whether it is a supported retained measurement. */
function isMeasurementOrNull(value: unknown): boolean {
  if (value === null) return true;
  return isRecord(value)
    && (value.unit === "dxa" || value.unit === "character")
    && Number.isInteger(value.value);
}

/** @param value - Candidate numbering-level tab. @returns Whether it uses canonical paragraph tab semantics. */
function isTabStop(value: unknown): boolean {
  return isRecord(value) && value.position !== null && isMeasurementOrNull(value.position)
    && ["start", "center", "end", "decimal", "bar", "num", "clear"].includes(String(value.alignment))
    && (value.leader === undefined || value.leader === null || typeof value.leader === "string");
}

/** @param value - Candidate object. @returns Whether it is a non-array record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
