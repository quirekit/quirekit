import { Mapping, StepMap } from "@quirekit/pm";
import type { QuireViewEngineFrameBuildOptions } from "./types";

/**
 * Builds the position mapping from the canonical document to the frame
 * document, in the order the frame state applies them: admitted presentation
 * overlay steps, then the visible IME preedit. Transient node patches are left
 * out; a drag preview keeps frame-document positions.
 *
 * @param options - Frame options resolved by `resolveQuirePresentationFrameOptions`.
 * @returns Mapping, or undefined when the frame document has canonical positions.
 */
export function resolveQuireFramePositionMapping(options: QuireViewEngineFrameBuildOptions): Mapping | undefined {
  const maps: StepMap[] = options.presentationOverlay?.steps.map((step) => step.getMap()) ?? [];
  const preedit = options.imePreedit;
  if (preedit !== undefined && preedit.text.length > 0) {
    maps.push(new StepMap([preedit.range.from, preedit.range.to - preedit.range.from, preedit.text.length]));
  }
  return maps.length === 0 ? undefined : new Mapping(maps);
}
