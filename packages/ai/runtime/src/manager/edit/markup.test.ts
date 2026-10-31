import { describe, expect, it } from "vitest";
import { parseQuireAiInline, parseQuireAiRecord } from "./markup";

describe("inline markup", () => {
  it("parses emphasis, spans and nesting", () => {
    expect(parseQuireAiInline("本季度的**核心指标**全部达成，[风险]{color:\"#FF0000\", fontSize:\"18pt\"}见*下*。")).toEqual({
      text: "本季度的核心指标全部达成，风险见下。",
      spans: [
        { start: 4, end: 8, name: "bold", value: true },
        { start: 13, end: 15, name: "color", value: "#FF0000" },
        { start: 13, end: 15, name: "fontSize", value: "18pt" },
        { start: 16, end: 17, name: "italic", value: true }
      ]
    });
    expect(parseQuireAiInline("**[x]{color:\"red\"}**").spans).toEqual([
      { start: 0, end: 1, name: "color", value: "red" },
      { start: 0, end: 1, name: "bold", value: true }
    ]);
  });

  it("keeps unmatched delimiters and escapes literal", () => {
    expect(parseQuireAiInline("5*3 = 15, [注] 见 \\*原文\\*")).toEqual({ text: "5*3 = 15, [注] 见 *原文*", spans: [] });
    expect(parseQuireAiInline("a ** b").text).toBe("a ** b");
  });

  it("turns <br/> into a line break inside the paragraph, also inside a formatted span", () => {
    expect(parseQuireAiInline("第一行<br/>第二行")).toEqual({ text: "第一行\u2028第二行", spans: [] });
    expect(parseQuireAiInline("**甲<br/>乙**")).toEqual({ text: "甲\u2028乙", spans: [{ start: 0, end: 3, name: "bold", value: true }] });
    expect(parseQuireAiInline("a \\<br/> b").text).toBe("a <br/> b");
  });

  it("parses records with unquoted keys and nested values", () => {
    expect(parseQuireAiRecord("{list:{kind:\"bullet\", level:0}, note:\"a:b\"}")).toEqual({ list: { kind: "bullet", level: 0 }, note: "a:b" });
    expect(() => parseQuireAiRecord("{color:}")).toThrow();
  });
});
