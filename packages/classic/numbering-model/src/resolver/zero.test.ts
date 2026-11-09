import { describe, expect, it } from "vitest";
import type { WordNumberingCounterFormat } from "../types";
import { wordNumberingFormats } from "../model/formats";
import { formatWordNumberingCounter } from "./format";
import observedFormats from "../testing/fixtures/zero-formats.json" with { type: "json" };
import observedLanguages from "../testing/fixtures/zero-languages.json" with { type: "json" };

const formats = observedFormats.results as { format: WordNumberingCounterFormat | "bullet"; value: number; reference: string }[];
const languages = observedLanguages.results as { language: string; format: WordNumberingCounterFormat; value: number; reference: string }[];

describe("independently observed zero numbering boundary", () => {
  it("covers every lexical format exactly once", () => {
    expect(formats.map(row => row.format).sort()).toEqual([...wordNumberingFormats].sort());
    expect(new Set(formats.map(row => row.format)).size).toBe(63);
  });

  for (const row of formats.filter(row => row.format !== "bullet")) {
    it(`formats zero for ${row.format}`, () => {
      expect(formatWordNumberingCounter(row.format as WordNumberingCounterFormat, 0)).toBe(row.reference);
    });
  }

  for (const row of languages) {
    it(`formats ${row.format} zero in ${row.language}`, () => {
      expect(formatWordNumberingCounter(row.format, 0, {
        language: { value: row.language, eastAsia: row.language, bidi: row.language }
      })).toBe(row.reference);
    });
  }

  it.each([
    ["α, β, γ, ...", ""],
    ["00001, 00002, 00003, ...", "00000"],
    ["0001, 0002, 0003, ...", "0000"],
    ["001, 002, 003, ...", "000"],
    ["A, Ç, Ĝ, ...", ""],
    ["a, ç, ĝ, ...", ""],
    ["unknown", "0"]
  ])("keeps zero within custom expression %s", (customFormat, expected) => {
    expect(formatWordNumberingCounter("custom", 0, { customFormat })).toBe(expected);
  });

  it.each([-1, -0.5, 0.5, Number.NaN, Infinity])("rejects invalid counter %s", value => {
    expect(() => formatWordNumberingCounter("decimal", value)).toThrow(RangeError);
  });
});
