import {
  createWordParagraphDxaMeasurement,
  wordParagraphMeasurementToTwips
} from "../model";
import type {
  WordParagraphFormatting,
  WordParagraphTabAlignment,
  WordParagraphTabStop
} from "../types";

const litAstToCanonicalAlignment: Readonly<Record<string, WordParagraphTabAlignment>> = {
  left: "start",
  start: "start",
  center: "center",
  right: "end",
  end: "end",
  decimal: "decimal",
  bar: "bar",
  num: "num",
  clear: "clear"
};

const canonicalToLitAstAlignment: Readonly<Record<WordParagraphTabAlignment, string>> = {
  start: "left",
  center: "center",
  end: "right",
  decimal: "decimal",
  bar: "bar",
  num: "num",
  clear: "clear"
};

/**
 * Projects producer-shaped LitAST tab stops into effective canonical paragraph tabs.
 *
 * Duplicate positions follow Word's last-definition-wins behavior. Unsupported
 * producer values stay available through the paragraph's lossless source attrs.
 *
 * @param value - Candidate LitAST `tabs` array.
 * @returns Sorted effective tab stops, or null when default tabs remain active.
 */
export function litAstParagraphTabsToWord(
  value: unknown
): WordParagraphFormatting["tabs"] {
  if (!Array.isArray(value)) return null;
  const byPosition = new Map<number, WordParagraphTabStop>();
  for (const candidate of value) {
    const record = readRecord(candidate);
    const position = record?.pos;
    const sourceAlignment = record?.val;
    if (
      typeof position !== "number"
      || !Number.isFinite(position)
      || typeof sourceAlignment !== "string"
    ) {
      continue;
    }
    const alignment = litAstToCanonicalAlignment[sourceAlignment];
    if (alignment === undefined) continue;
    const leader = typeof record?.leader === "string" ? record.leader : undefined;
    byPosition.set(Math.round(position), {
      position: createWordParagraphDxaMeasurement(position),
      alignment,
      ...(leader === undefined ? {} : { leader })
    });
  }
  const tabs = [...byPosition.values()].sort(compareTabPositions);
  return tabs.length === 0 ? null : tabs;
}

/**
 * Writes canonical paragraph tabs while retaining untouched producer source.
 *
 * @param target - Mutable LitAST paragraph attrs copied from preserved source.
 * @param tabs - Current canonical tab state.
 * @param snapshot - Canonical state captured with the preserved source attrs.
 */
export function writeWordParagraphTabsToLitAst(
  target: Record<string, unknown>,
  tabs: WordParagraphFormatting["tabs"],
  snapshot: readonly WordParagraphTabStop[] | null | undefined
): void {
  if (snapshot !== undefined && equalTabStops(tabs, snapshot)) return;
  const serialized = serializeCanonicalTabs(tabs);
  if (serialized.length === 0) delete target.tabs;
  else target.tabs = serialized;
}

/**
 * Serializes effective canonical stops in ascending physical position order.
 *
 * @param tabs - Current canonical tab state.
 * @returns LitAST-compatible tab stop records.
 */
function serializeCanonicalTabs(
  tabs: WordParagraphFormatting["tabs"]
): readonly Readonly<Record<string, unknown>>[] {
  if (tabs === null) return [];
  const byPosition = new Map<number, {
    readonly alignment: WordParagraphTabAlignment;
    readonly leader?: string | undefined;
  }>();
  for (const tab of tabs) {
    const position = Math.round(wordParagraphMeasurementToTwips(tab.position));
    byPosition.set(position, {
      alignment: tab.alignment,
      ...(typeof tab.leader === "string" ? { leader: tab.leader } : {})
    });
  }
  return [...byPosition.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pos, tab]) => ({
      val: canonicalToLitAstAlignment[tab.alignment],
      pos,
      ...(tab.leader === undefined ? {} : { leader: tab.leader })
    }));
}

/**
 * Compares two effective canonical tab collections independent of source order.
 *
 * @param left - Current tab state.
 * @param right - Imported tab snapshot.
 * @returns Whether both collections describe the same canonical state.
 */
function equalTabStops(
  left: WordParagraphFormatting["tabs"],
  right: readonly WordParagraphTabStop[] | null
): boolean {
  const normalizedLeft = normalizeCanonicalTabs(left);
  const normalizedRight = normalizeCanonicalTabs(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((tab, index) => {
    const other = normalizedRight[index];
    return other !== undefined
      && tab.position.unit === other.position.unit
      && tab.position.value === other.position.value
      && tab.alignment === other.alignment
      && (tab.leader ?? null) === (other.leader ?? null);
  });
}

/**
 * Collapses duplicate canonical positions for deterministic equality checks.
 *
 * @param tabs - Candidate canonical stops.
 * @returns Stops sorted by unit and numeric position.
 */
function normalizeCanonicalTabs(
  tabs: WordParagraphFormatting["tabs"]
): readonly WordParagraphTabStop[] {
  if (tabs === null) return [];
  const byPosition = new Map<string, WordParagraphTabStop>();
  for (const tab of tabs) {
    byPosition.set(
      `${tab.position.unit}:${tab.position.value}`,
      tab
    );
  }
  return [...byPosition.values()].sort((left, right) => {
    const unitOrder = left.position.unit.localeCompare(right.position.unit);
    return unitOrder !== 0 ? unitOrder : compareTabPositions(left, right);
  });
}

/**
 * Orders two stops by their retained numeric position.
 *
 * @param left - First tab stop.
 * @param right - Second tab stop.
 * @returns Standard sort comparison result.
 */
function compareTabPositions(
  left: WordParagraphTabStop,
  right: WordParagraphTabStop
): number {
  return left.position.value - right.position.value;
}

/**
 * Reads a non-array object before producer-field access.
 *
 * @param value - Candidate object.
 * @returns Record or undefined.
 */
function readRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}
