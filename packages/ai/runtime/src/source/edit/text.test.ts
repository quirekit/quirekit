import { describe, expect, it } from "vitest";
import { findQuireAiSourceText, indentQuireAiMarkdown, normalizeQuireAiMarkdown } from "./text";

describe("source edit text", () => {
  it("normalizes written Markdown", () => {
    expect(normalizeQuireAiMarkdown("\n\r\n# 标题\r\n正文\n\n  ")).toBe("# 标题\n正文");
  });

  it("indents continuation lines", () => {
    expect(indentQuireAiMarkdown("- a\n  b\n\nc", "  ", false)).toBe("- a\n    b\n\n  c");
    expect(indentQuireAiMarkdown("- a", "  ", true)).toBe("  - a");
  });

  it("finds listed text across stripped indentation", () => {
    const text = "- a\n  - one\n    two\n";
    const from = text.indexOf("- one");
    const found = findQuireAiSourceText(text, from, text.length - 1, "  ", "one\n  two");
    expect(found).toHaveLength(1);
    expect(text.slice(found[0]!.from, found[0]!.to)).toBe("one\n    two");
  });
});
