import { describe, expect, it } from "vitest";
import { describeFormatChange, trimKeptText } from "./review-changes";

describe("review change phrases", () => {
  it("writes switches, set, cleared and changed values", () => {
    expect(describeFormatChange({ label: "加粗", before: "true", after: null, toggle: true, text: "方式。" }, "zh-CN")).toBe("取消加粗 · 方式。");
    expect(describeFormatChange({ label: "加粗", before: null, after: "true", toggle: true }, "zh-CN")).toBe("加粗");
    expect(describeFormatChange({ label: "对齐", before: null, after: "居中", toggle: false }, "zh-CN")).toBe("对齐：居中");
    expect(describeFormatChange({ label: "对齐", before: "居中", after: null, toggle: false }, "zh-CN")).toBe("取消对齐（原为居中）");
    expect(describeFormatChange({ label: "对齐", before: "居中", after: "左对齐", toggle: false }, "zh-CN")).toBe("对齐：居中 → 左对齐");
    expect(describeFormatChange({ label: "Bold", before: "true", after: null, toggle: true }, "en")).toBe("Remove Bold");
  });

  it("keeps only the kept text next to a change", () => {
    const long = "一二三四五六七八九十".repeat(3);
    expect(trimKeptText([{ kind: "same", text: long }, { kind: "removed", text: "旧" }, { kind: "inserted", text: "新" }, { kind: "same", text: long }])).toEqual([
      { kind: "same", text: "…九十一二三四五六七八九十" }, { kind: "removed", text: "旧" }, { kind: "inserted", text: "新" }, { kind: "same", text: "一二三四五六七八九十一二…" }
    ]);
    expect(trimKeptText([{ kind: "inserted", text: "新" }, { kind: "same", text: long }, { kind: "removed", text: "旧" }])[1]).toEqual({ kind: "same", text: "一二三四五六…五六七八九十" });
  });
});
