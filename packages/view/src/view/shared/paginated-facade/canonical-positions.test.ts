import { Mapping, StepMap } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import type { QuireViewRenderResult } from "../../types";
import { toCanonicalHit, toFramePosition } from "./canonical-positions";

/** @param mapping - Canonical-to-frame mapping. @returns Render result carrying only that mapping. */
const frameWith = (mapping?: Mapping) => (mapping === undefined ? {} : { canonicalPositionMapping: mapping }) as unknown as QuireViewRenderResult;

// A 9-character IME preedit inserted at canonical position 6.
const preedit = new Mapping([new StepMap([6, 0, 9])]);

describe("canonical positions of mounted geometry queries", () => {
  it("queries frame geometry after a preedit at the same characters a canonical position names", () => {
    expect(toFramePosition(frameWith(preedit), 20, 1)).toBe(29);
    expect(toFramePosition(frameWith(preedit), 3, 1)).toBe(3);
    expect(toFramePosition(frameWith(preedit), 6, -1)).toBe(6);
    expect(toFramePosition(frameWith(preedit), 6, 1)).toBe(15);
    expect(toFramePosition(frameWith(), 20, 1)).toBe(20);
  });

  it("returns hits in canonical positions, and a hit inside the preedit at the composition point", () => {
    expect(toCanonicalHit(frameWith(preedit), { pos: 29, inside: 5 })).toEqual({ pos: 20, inside: 5 });
    expect(toCanonicalHit(frameWith(preedit), { pos: 10, inside: -1 })).toEqual({ pos: 6, inside: -1 });
    const hit = { pos: 29, inside: -1 };
    expect(toCanonicalHit(frameWith(), hit)).toBe(hit);
  });
});
