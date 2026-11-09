import type { QuireTextLayoutOptions } from "../types";
import type { QuireTextTabPaint, QuireTextTabs } from "./types";

/**
 * Resolves an explicit stop or default grid in the current logical line slot.
 *
 * The field width is measured from the same source units used by wrapping.
 * Stops beyond the slot end are clipped before alignment, so a narrow column
 * cannot push the following page number outside its content area.
 *
 * @param tabs - Paragraph tab configuration.
 * @param position - Current logical position relative to the unindented origin.
 * @param end - Logical end of the available line slot.
 * @param fieldWidth - Measured following field up to the next tab or hard break.
 * @returns Advance and leader, or undefined when no successor is configured.
 */
export function resolveTextTab(
  tabs: QuireTextTabs, position: number, end: number, fieldWidth: number
): { readonly advance: number; readonly leader?: string | undefined } | undefined {
  let low = 0;
  let high = tabs.stops.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (tabs.stops[middle]!.position <= position + 0.001) low = middle + 1;
    else high = middle;
  }
  const stop = tabs.stops[low];
  if (stop === undefined) {
    if (tabs.defaultInterval === undefined) return undefined;
    // A hanging first line reaches the normal region edge before the grid.
    // Arithmetic then keeps subsequent stepping bounded even for a tiny interval.
    const target = position < (tabs.offset ?? 0) - 0.001 ? tabs.offset ?? 0 : position < -0.001 ? 0
      : (Math.floor((position + 0.001) / tabs.defaultInterval) + 1) * tabs.defaultInterval;
    return { advance: Math.max(0, Math.min(target, end) - position) };
  }
  const reserve = stop.alignment === "end" ? fieldWidth : stop.alignment === "center" ? fieldWidth / 2 : 0;
  return { advance: Math.max(0, Math.min(stop.position, end) - position - reserve), leader: stop.leader };
}

/**
 * Validates tab geometry once before wrapping can enter a row-seek loop.
 * @param tabs - Public neutral tab configuration.
 */
export function validateTextTabs(tabs: QuireTextTabs | undefined): void {
  if (tabs === undefined) return;
  if (!Number.isFinite(tabs.offset ?? 0)) throw new RangeError("Tab origin must be finite.");
  if (tabs.defaultInterval !== undefined && (!Number.isFinite(tabs.defaultInterval) || tabs.defaultInterval <= 0)) {
    throw new RangeError("Default tab interval must be positive and finite.");
  }
  let previous = -Infinity;
  for (const stop of tabs.stops) {
    if (!Number.isFinite(stop.position) || stop.position < previous) {
      throw new RangeError("Tab positions must be finite and in increasing order.");
    }
    previous = stop.position;
  }
}

/**
 * Measures a bounded leader string without adding any source characters.
 *
 * One glyph of breathing room at each edge separates the leader from authored
 * text. The exact measured string is shared by both paint backends.
 *
 * @param width - Available tab advance in CSS pixels.
 * @param leader - Optional repeated character.
 * @param font - Tab source font.
 * @param measure - Native measurer used for leader paint.
 * @returns Paint-only text centered inside the tab's retained bounds.
 */
export function createTextTabPaint(
  width: number, leader: string | undefined, font: string,
  measure: QuireTextLayoutOptions["measureText"]
): QuireTextTabPaint {
  if (leader === undefined || leader.length === 0 || width <= 0) return { text: "", offset: 0 };
  const unit = measure(leader, font).width;
  if (!Number.isFinite(unit) || unit <= 0) return { text: "", offset: 0 };
  const count = Math.min(16384, Math.max(0, Math.floor(width / unit) - 2));
  // Kerning may make repeated glyphs differ from a single-glyph estimate.
  // Binary search bounds both the work and the final painted extent.
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(leader.repeat(middle), font).width <= width - unit * 2) low = middle;
    else high = middle - 1;
  }
  const text = leader.repeat(low);
  return { text, offset: Math.max(0, (width - measure(text, font).width) / 2) };
}
