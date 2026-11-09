import type { ShapedRunData } from "./shaping";
import type { QuireTextBaseDirection } from "./bidi";
import type { BreakUnit, RunGrapheme } from "./units";
import type { QuireTextLayoutOptions } from "./types";
import type { LineRun, WrapGroupRange } from "./wrap/types";
import { createTextWrapState } from "./wrap/state";
import { measureBreakUnitAtIndex, measureTextGroupRange } from "./wrap/measurement";
import { appendOverlongText } from "./wrap/overflow";
import { createTextTabPaint, resolveTextTab, validateTextTabs } from "./tabs/resolve";
import { measureCharacterGrid } from "./character-grid/meter";

export type { LineRun, LineSlotRun } from "./wrap/types";

/**
 * Packs line-breaking units onto visual lines, honoring hard breaks, width,
 * word groups, NBSP glue, and overlong-word grapheme fallback.
 *
 * Words and punctuation-protected groups stay together when they fit. Overlong
 * words fall back to graphemes while preserving punctuation pairs that fit;
 * NBSP-glued groups retain the existing indivisible overflow contract.
 *
 * @param units - Line-breaking units in source order.
 * @param maxWidth - Wrap width; use `Infinity` to disable wrapping.
 * @param measureText - Measurer used only for runs the shaper did not cover.
 * @param shapedData - Per-run shaping data; shaped runs take their unit widths from
 * the shaper advances (no `measureText`), so line breaks use the same widths as the
 * rendered cluster geometry.
 * @param lineSlots - Optional leading visual-row slot declarations.
 * @param baseDirection - Paragraph base direction controlling slot progression.
 * @param tabs - Optional explicit paragraph tab geometry.
 * @param avoidPunctuationBreaks - Protect basic Chinese punctuation boundaries.
 * @param allowSoftWrap - Whether width may introduce lines beyond explicit breaks.
 * @returns Visual line runs with their source anchors.
 */
export function wrapUnitsIntoLines(
  units: readonly BreakUnit[],
  maxWidth: number,
  measureText: QuireTextLayoutOptions["measureText"],
  shapedData: ReadonlyMap<number, ShapedRunData>,
  lineSlots: QuireTextLayoutOptions["lineSlots"] = undefined,
  baseDirection: QuireTextBaseDirection | undefined = undefined,
  tabs: QuireTextLayoutOptions["tabs"] = undefined,
  avoidPunctuationBreaks = true,
  allowSoftWrap = true
): readonly LineRun[] {
  validateTextTabs(tabs);
  if ((maxWidth !== Number.POSITIVE_INFINITY && !Number.isFinite(maxWidth)) || maxWidth < 0) {
    throw new RangeError("Text wrap width must be a non-negative finite number or Infinity.");
  }
  const characterGrid = units[0]?.graphemes[0]?.naturalAdvance !== undefined;
  const state = createTextWrapState({ maxWidth, lineSlots, baseDirection, characterGrid });
  const unitWidths: number[] = [];
  const groupRange: WrapGroupRange = {
    startIndex: 0,
    endIndex: 0,
    width: 0,
    nonBreakingGlue: false
  };
  /**
   * Appends one unit to the current line.
   *
   * @param unit - Unit to append.
   * @param unitIndex - Unit index used by the width cache.
   */
  const appendUnit = (unit: BreakUnit, unitIndex: number): void => {
    state.append(unit.graphemes, measureBreakUnitAtIndex(
      units,
      unitIndex,
      measureText,
      shapedData,
      unitWidths
    ));
  };

  /**
   * Appends a range of units to the current line.
   *
   * @param startIndex - Inclusive unit start.
   * @param endIndex - Exclusive unit end.
   */
  const appendUnitRange = (startIndex: number, endIndex: number): void => {
    for (let unitIndex = startIndex; unitIndex < endIndex; unitIndex += 1) {
      appendUnit(units[unitIndex]!, unitIndex);
    }
  };

  /**
   * Appends an overlong source group, falling back to grapheme breaks unless the
   * group is glued by NBSP.
   *
   * @param group - Protected unit range wider than the line.
   */
  const appendOverlongGroup = (group: WrapGroupRange): void => {
    if (group.nonBreakingGlue) {
      state.seek(group.width, true, units[group.startIndex]!.graphemes[0]!.spacingBefore,
        characterGrid ? units.slice(group.startIndex, group.endIndex).flatMap(item => item.graphemes) : undefined);
      appendUnitRange(group.startIndex, group.endIndex);
      return;
    }
    appendOverlongText(
      units.slice(group.startIndex, group.endIndex).flatMap(unit => unit.graphemes),
      state, maxWidth, measureText, shapedData, avoidPunctuationBreaks
    );
  };

  for (let index = 0; index < units.length; ) {
    const unit = units[index]!;

    if (unit.kind === "hardBreak") {
      state.flush("soft-break");
      const grapheme = unit.graphemes[0]!;
      state.fallback = { run: grapheme.run, offset: grapheme.offset + grapheme.text.length };
      index += 1;
      continue;
    }

    if (unit.text === "\t" && tabs !== undefined && (tabs.stops.length > 0 || tabs.defaultInterval !== undefined)) {
      // Tab fields are disjoint; lookahead reuses wrap's width cache and never
      // scans a following field again for a later tab.
      let fieldWidth = 0;
      const field: RunGrapheme[] | undefined = characterGrid ? [] : undefined;
      for (let next = index + 1; next < units.length; next += 1) {
        if (units[next]!.text === "\t" || units[next]!.kind === "hardBreak") break;
        fieldWidth += measureBreakUnitAtIndex(units, next, measureText, shapedData, unitWidths);
        field?.push(...units[next]!.graphemes);
      }
      if (field) fieldWidth = measureCharacterGrid(field);
      state.seek(0, true);
      let slot = state.slot;
      if (allowSoftWrap && state.width > 0 && fieldWidth <= maxWidth && fieldWidth > slot.width - state.width) {
        state.seek(fieldWidth, false);
        slot = state.slot;
      }
      const leading = (tabs.offset ?? 0)
        + (baseDirection === "rtl" ? maxWidth - slot.x - slot.width : slot.x);
      const resolved = resolveTextTab(tabs, leading + state.width, leading + slot.width, fieldWidth);
      if (resolved !== undefined) {
        const advance = Math.min(resolved.advance, Math.max(0, slot.width - state.width));
        const grapheme = unit.graphemes[0]!;
        state.append([{ ...grapheme, tabAdvance: advance,
          tab: createTextTabPaint(advance, resolved.leader, grapheme.font, measureText) }], advance);
        index += 1;
        continue;
      }
    }

    const group = measureTextGroupRange(
      units, index, measureText, shapedData, unitWidths, groupRange, avoidPunctuationBreaks
    );
    const leading = unit.graphemes[0]!.spacingBefore ?? 0;
    const candidate = characterGrid ? units.slice(group.startIndex, group.endIndex).flatMap(item => item.graphemes) : undefined;
    if (candidate) group.width = measureCharacterGrid(candidate) + leading;
    if (!allowSoftWrap) {
      // Fitted text keeps its source lines; the caller scales the complete shaped geometry.
      state.seek(0, true);
      appendUnitRange(group.startIndex, group.endIndex);
    } else if (group.width - leading > maxWidth && (unit.kind === "word" || group.endIndex > index + 1)) {
      appendOverlongGroup(group);
    } else {
      state.seek(group.width, group.width - leading > maxWidth, leading, candidate);
      appendUnitRange(group.startIndex, group.endIndex);
    }
    index = group.endIndex;
  }

  state.flush("paragraph-end");
  return state.lines;
}
