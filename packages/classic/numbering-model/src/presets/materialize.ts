import { v4 } from "uuid";
import type {
  WordAbstractNumbering,
  WordNumberingLevel,
  WordNumberingRegistry
} from "../types";
import { createDefaultWordNumberingRegistry, getDefaultWordAbstractNumId } from "../model/defaults";
import { cloneWordNumberingPresetLevel } from "./ownership";
import type { WordNumberingPresetContribution } from "./types";

/** Prefix reserved for document definitions materialized from presets. */
const presetAbstractIdPrefix = "quirekit-preset-abstract-";

/**
 * Materializes one preset as a self-contained canonical abstract definition.
 *
 * A single-level preset preserves an existing same-family definition and replaces
 * only the destination level. Cross-family application starts from target-family
 * defaults so the canonical model never creates an unrepresentable hybrid family.
 *
 * @param preset - Valid immutable semantic preset.
 * @param base - Complete same-family or target-family base definition.
 * @param destinationLevel - Effective zero-based level for a single-level preset.
 * @param id - Collision-safe document definition id.
 * @returns Fresh canonical abstract definition.
 */
export function materializeWordNumberingPreset(
  preset: WordNumberingPresetContribution,
  base: WordAbstractNumbering,
  destinationLevel: number,
  id: string
): WordAbstractNumbering {
  const levels: Record<string, WordNumberingLevel> = {};
  if (preset.scope === "multilevel") {
    for (let level = 0; level < 9; level += 1) {
      levels[String(level)] = cloneWordNumberingPresetLevel(
        preset.levels[String(level)]!
      );
    }
  }
  else {
    const fallback = createDefaultWordNumberingRegistry().abstractNums[getDefaultWordAbstractNumId(base.kind)]!;
    for (let level = 0; level < 9; level += 1) {
      levels[String(level)] = cloneWordNumberingPresetLevel(
        base.levels[String(level)] ?? fallback.levels[String(level)]!
      );
    }
    levels[String(destinationLevel)] = materializeWordNumberingSingleLevelPreset(
      preset,
      destinationLevel
    );
  }
  return { id, kind: preset.kind, levels };
}

/**
 * Maps one portable single-level tuple to a concrete document level.
 *
 * @param preset - Valid single-level semantic preset.
 * @param destinationLevel - Zero-based destination level.
 * @returns Fresh canonical level with its own placeholder remapped.
 */
export function materializeWordNumberingSingleLevelPreset(
  preset: Extract<WordNumberingPresetContribution, { readonly scope: "singleLevel" }>,
  destinationLevel: number
): WordNumberingLevel {
  const text = preset.level.format === "bullet"
    ? preset.level.text
    : preset.level.text.replace(/%1(?![0-9])/gu, `%${destinationLevel + 1}`);
  return cloneWordNumberingPresetLevel({
    ...preset.level,
    level: destinationLevel,
    text
  });
}

/**
 * Allocates one document abstract definition id, a uuid so definitions
 * created concurrently by collaborators never share one.
 *
 * @param registry - Current canonical document registry.
 * @returns Unused QuireKit preset-definition id.
 */
export function allocateWordNumberingPresetAbstractId(
  registry: WordNumberingRegistry
): string {
  let id = `${presetAbstractIdPrefix}${v4()}`;
  while (registry.abstractNums[id] !== undefined) id = `${presetAbstractIdPrefix}${v4()}`;
  return id;
}

/**
 * Compares complete authorable numbering definitions without considering ids.
 *
 * @param left - First canonical definition.
 * @param right - Second canonical definition.
 * @returns Whether kind and all nine authorable level tuples match.
 */
export function areWordNumberingDefinitionsEqual(
  left: WordAbstractNumbering,
  right: WordAbstractNumbering
): boolean {
  if (left.kind !== right.kind) return false;
  for (let level = 0; level < 9; level += 1) {
    const key = String(level);
    const leftLevel = left.levels[key];
    const rightLevel = right.levels[key];
    if (
      leftLevel === undefined
      || rightLevel === undefined
      || !areWordNumberingLevelsEqual(leftLevel, rightLevel)
    ) return false;
  }
  return true;
}

/**
 * Compares every authorable field in two canonical numbering levels.
 *
 * @param left - First level tuple.
 * @param right - Second level tuple.
 * @returns Whether both levels have identical canonical semantics.
 */
export function areWordNumberingLevelsEqual(
  left: WordNumberingLevel,
  right: WordNumberingLevel
): boolean {
  return createLevelSignature(left) === createLevelSignature(right);
}

/**
 * Creates a property-order-independent signature over the admitted level fields.
 *
 * @param level - Canonical numbering level.
 * @returns Stable semantic signature.
 */
function createLevelSignature(level: WordNumberingLevel): string {
  return JSON.stringify({
    level: level.level,
    format: level.format,
    customFormat: level.customFormat ?? null,
    text: level.text,
    start: level.start,
    restartAfterLevel: level.restartAfterLevel === undefined
      ? "default"
      : level.restartAfterLevel === null ? "never" : level.restartAfterLevel,
    isLegal: level.isLegal ?? false,
    paragraphStyleId: level.paragraphStyleId ?? null,
    paragraphTabs: level.paragraphTabs ?? null,
    suffix: level.suffix,
    justification: level.justification,
    paragraphIndentation: {
      start: createMeasurementSignature(level.paragraphIndentation.start),
      end: createMeasurementSignature(level.paragraphIndentation.end),
      firstLine: createMeasurementSignature(level.paragraphIndentation.firstLine)
    },
    markerStyle: level.markerStyle === undefined ? null : {
      fonts: level.markerStyle.fonts === undefined ? null : {
        ascii: level.markerStyle.fonts.ascii ?? null,
        highAnsi: level.markerStyle.fonts.highAnsi ?? null,
        eastAsia: level.markerStyle.fonts.eastAsia ?? null,
        complexScript: level.markerStyle.fonts.complexScript ?? null,
        asciiTheme: level.markerStyle.fonts.asciiTheme ?? null,
        highAnsiTheme: level.markerStyle.fonts.highAnsiTheme ?? null,
        eastAsiaTheme: level.markerStyle.fonts.eastAsiaTheme ?? null,
        complexScriptTheme:
          level.markerStyle.fonts.complexScriptTheme ?? null,
        hint: level.markerStyle.fonts.hint ?? null
      },
      language: level.markerStyle.language === undefined ? null : {
        value: level.markerStyle.language.value ?? null,
        eastAsia: level.markerStyle.language.eastAsia ?? null,
        bidi: level.markerStyle.language.bidi ?? null
      },
      fontSizePt: level.markerStyle.fontSizePt ?? null,
      complexScriptFontSizePt:
        level.markerStyle.complexScriptFontSizePt ?? null,
      bold: level.markerStyle.bold ?? null,
      complexScriptBold: level.markerStyle.complexScriptBold ?? null,
      italic: level.markerStyle.italic ?? null,
      complexScriptItalic: level.markerStyle.complexScriptItalic ?? null,
      color: level.markerStyle.color ?? null,
      underline: level.markerStyle.underline ?? null,
      strike: level.markerStyle.strike ?? null
    }
  });
}

/**
 * Normalizes one retained paragraph measurement for semantic comparison.
 *
 * @param measurement - Nullable canonical measurement.
 * @returns Stable unit/value tuple or null.
 */
function createMeasurementSignature(
  measurement: WordNumberingLevel["paragraphIndentation"]["start"]
): { readonly unit: string; readonly value: number } | null {
  return measurement === null
    ? null
    : { unit: measurement.unit, value: measurement.value };
}
