import { describe, expect, it } from "vitest";
import { formatWordNumberingCounter } from "./format";

describe("Word numbering counter formats", () => {
  it("formats decimal-zero and WPS enclosed-circle boundaries", () => {
    expect(formatWordNumberingCounter("decimalZero", 1)).toBe("01");
    expect(formatWordNumberingCounter("decimalZero", 9)).toBe("09");
    expect(formatWordNumberingCounter("decimalZero", 10)).toBe("10");
    expect(formatWordNumberingCounter("decimalEnclosedCircleChinese", 1)).toBe("①");
    expect(formatWordNumberingCounter("decimalEnclosedCircleChinese", 10)).toBe("⑩");
    expect(formatWordNumberingCounter("decimalEnclosedCircleChinese", 11)).toBe("11");
  });

  it("formats subtractive Roman values with stable case and bounded cycling", () => {
    expect(formatWordNumberingCounter("upperRoman", 4)).toBe("IV");
    expect(formatWordNumberingCounter("upperRoman", 49)).toBe("XLIX");
    expect(formatWordNumberingCounter("lowerRoman", 944)).toBe("cmxliv");
    expect(formatWordNumberingCounter("upperRoman", 32_768)).toBe("I");
  });

  it("uses Word repeated-letter numbering instead of spreadsheet columns", () => {
    expect(formatWordNumberingCounter("upperLetter", 1)).toBe("A");
    expect(formatWordNumberingCounter("upperLetter", 26)).toBe("Z");
    expect(formatWordNumberingCounter("upperLetter", 27)).toBe("AA");
    expect(formatWordNumberingCounter("upperLetter", 28)).toBe("BB");
    expect(formatWordNumberingCounter("lowerLetter", 52)).toBe("zz");
    expect(formatWordNumberingCounter("lowerLetter", 53)).toBe("aaa");
    expect(formatWordNumberingCounter("lowerLetter", 781)).toBe("a");
  });

  it("formats the audited Chinese counting families without decimal approximation", () => {
    expect(formatWordNumberingCounter("chineseCounting", 1)).toBe("一");
    expect(formatWordNumberingCounter("chineseCounting", 10)).toBe("十");
    expect(formatWordNumberingCounter("chineseCounting", 11)).toBe("十一");
    expect(formatWordNumberingCounter("chineseCounting", 20)).toBe("二十");
    expect(formatWordNumberingCounter("chineseCounting", 100)).toBe("一○○");
    expect(formatWordNumberingCounter("chineseCounting", 101)).toBe("一○一");

    expect(formatWordNumberingCounter("chineseCountingThousand", 10)).toBe("十");
    expect(formatWordNumberingCounter("chineseCountingThousand", 101)).toBe("一百○一");
    expect(formatWordNumberingCounter("chineseCountingThousand", 1001)).toBe("一千○一");
    expect(formatWordNumberingCounter("chineseCountingThousand", 10_000)).toBe("一万");
    expect(formatWordNumberingCounter("chineseCountingThousand", 100_000))
      .toBe("一十万");

    expect(formatWordNumberingCounter("chineseLegalSimplified", 10)).toBe("壹拾");
    expect(formatWordNumberingCounter("chineseLegalSimplified", 101)).toBe("壹佰零壹");
    expect(formatWordNumberingCounter("chineseLegalSimplified", 1001)).toBe("壹仟零壹");
    expect(formatWordNumberingCounter("chineseLegalSimplified", 10_000)).toBe("壹萬");
  });

  it("formats the audited Japanese and zodiac boundaries", () => {
    expect(formatWordNumberingCounter("japaneseCounting", 10)).toBe("十");
    expect(formatWordNumberingCounter("japaneseCounting", 101)).toBe("百一");
    expect(formatWordNumberingCounter("japaneseCounting", 1001)).toBe("千一");
    expect(formatWordNumberingCounter("japaneseCounting", 10_000)).toBe("一万");
    expect(formatWordNumberingCounter("japaneseCounting", 1_000_000))
      .toBe("");

    expect(formatWordNumberingCounter("ideographZodiac", 1)).toBe("子");
    expect(formatWordNumberingCounter("ideographZodiac", 12)).toBe("亥");
    expect(formatWordNumberingCounter("ideographZodiac", 13)).toBe("13");
  });

  it("formats deterministic enclosed and decimal-width families", () => {
    expect(formatWordNumberingCounter("decimalEnclosedCircle", 1)).toBe("①");
    expect(formatWordNumberingCounter("decimalEnclosedCircle", 20)).toBe("⑳");
    expect(formatWordNumberingCounter("decimalEnclosedCircle", 21)).toBe("21");
    expect(formatWordNumberingCounter("decimalEnclosedFullstop", 1)).toBe("⒈");
    expect(formatWordNumberingCounter("decimalEnclosedFullstop", 20)).toBe("⒛");
    expect(formatWordNumberingCounter("decimalEnclosedParen", 1)).toBe("⑴");
    expect(formatWordNumberingCounter("decimalEnclosedParen", 20)).toBe("⒇");
    expect(formatWordNumberingCounter("decimalFullWidth", 120)).toBe("１２０");
    expect(formatWordNumberingCounter("decimalFullWidth2", 907)).toBe("９０７");
    expect(formatWordNumberingCounter("decimalHalfWidth", 120)).toBe("120");
  });

  it("formats deterministic ideograph, hexadecimal, dash, and empty families", () => {
    expect(formatWordNumberingCounter("ideographEnclosedCircle", 1)).toBe("㈠");
    expect(formatWordNumberingCounter("ideographEnclosedCircle", 10)).toBe("㈩");
    expect(formatWordNumberingCounter("ideographEnclosedCircle", 11)).toBe("11");
    expect(formatWordNumberingCounter("ideographTraditional", 1)).toBe("甲");
    expect(formatWordNumberingCounter("ideographTraditional", 10)).toBe("癸");
    expect(formatWordNumberingCounter("ideographTraditional", 11)).toBe("11");
    expect(formatWordNumberingCounter("ideographZodiacTraditional", 1)).toBe("甲子");
    expect(formatWordNumberingCounter("ideographZodiacTraditional", 60)).toBe("癸亥");
    expect(formatWordNumberingCounter("ideographZodiacTraditional", 61)).toBe("甲子");
    expect(formatWordNumberingCounter("hex", 15)).toBe("F");
    expect(formatWordNumberingCounter("hex", 65_535)).toBe("FFFF");
    expect(formatWordNumberingCounter("hex", 65_536)).toBe("");
    expect(formatWordNumberingCounter("numberInDash", 12)).toBe("- 12 -");
    expect(formatWordNumberingCounter("none", 12)).toBe("");
  });

  it("rejects counters outside the validated canonical domain", () => {
    expect(() => formatWordNumberingCounter("decimal", -1)).toThrow(RangeError);
    expect(() => formatWordNumberingCounter("decimal", 1.5)).toThrow(RangeError);
  });
});
