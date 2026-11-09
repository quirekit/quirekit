import { describe, expect, it } from "vitest";
import type { HtmlTextDesc } from "../../descriptors";
import { findHtmlTextDescriptor } from "./text-query";

describe("retained text position queries", () => {
  it("bounds lookups by ordered text ranges", () => {
    let visits = 0;
    const texts = Array.from({ length: 4096 }, (_, index) => ({
      get kind() { visits++; return "text"; },
      get range() { visits++; return { from: index * 4, to: index * 4 + 3 }; }
    } as HtmlTextDesc));
    expect(findHtmlTextDescriptor(texts, 12001, 1)).toBe(texts[3000]);
    expect(visits).toBeLessThan(40);
  });

  it("matches linear boundary selection through adjacent marked runs and gaps", () => {
    const texts = [[1, 4], [4, 6], [6, 9], [12, 15], [18, 20]].map(([from, to]) =>
      ({ kind: "text", range: { from, to } } as HtmlTextDesc));
    for (let pos = 0; pos <= 21; pos++) {
      for (const side of [-1, 0, 1]) {
        const expected = side < 0
          ? [...texts].reverse().find(text => text.range.from < pos && pos <= text.range.to)
          : texts.find(text => text.range.from <= pos && pos < text.range.to)
            ?? texts.find(text => text.range.from <= pos && pos <= text.range.to);
        expect(findHtmlTextDescriptor(texts, pos, side)).toBe(expected);
      }
    }
  });
});
