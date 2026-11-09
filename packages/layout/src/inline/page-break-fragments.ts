import type { QuireTextLineBox } from "@quirekit/renderer";
import type { QuireTextFragment } from "../text";
import type { QuireInlineLayoutOptions, QuireInlineTextRun } from "./types";
import { resolveQuireInlineRunPosition } from "./run-slice";

/**
 * Restores zero-width page- and column-break source topology after renderer line breaking.
 * The renderer excludes newline clusters from paint. Their source identity and
 * forced boundary still belong to the outgoing line; the next line owns the
 * caret after the atom. No text measurement or extra paragraph is introduced.
 * @param fragments - Mutable measured line fragments.
 * @param runs - Visible source runs used by the renderer.
 * @param lines - Renderer-local line boxes and logical endpoints.
 * @param options - Infinite-flow paragraph origin and fallback geometry.
 */
export function appendInlinePageBreakFragments(
  fragments: QuireTextFragment[], runs: readonly QuireInlineTextRun[],
  lines: readonly QuireTextLineBox[], options: QuireInlineLayoutOptions
): void {
  const breaks = new Map(runs.filter(run => run.breakAfter !== undefined)
    .map(run => [run.range.from, run]));
  if (breaks.size === 0) return;
  for (const [index, line] of lines.entries()) {
    const endRun = runs[line.end.run];
    if (!endRun) continue;
    const position = resolveQuireInlineRunPosition(endRun, line.end.offset);
    const run = breaks.get(position);
    if (!run) continue;
    breaks.delete(position);
    const y = options.rect.y + line.rect.y;
    const previous = fragments.find(fragment => fragment.rect.y === y
      && fragment.caretStops.some(stop => stop.position.pos === position));
    const stop = previous?.caretStops.find(stop => stop.position.pos === position);
    const x = previous && stop ? previous.rect.x + stop.localX : options.rect.x;
    fragments.push({
      id: `${options.id}:${run.breakAfter}-break:${index}`, text: "", range: run.range,
      rect: { x, y, width: 0, height: line.rect.height }, font: run.font,
      lineHeight: line.rect.height, baseline: y + line.baselineOffset,
      breakAfter: run.breakAfter, marks: run.marks,
      caretStops: [{ position: { pos: position, bias: -1 }, localX: 0 }]
    });
  }
}
