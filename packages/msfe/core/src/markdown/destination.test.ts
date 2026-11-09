import { describe, expect, it } from "vitest";
import { decodeMarkdownDestination, encodeMarkdownDestination } from "./strings";

describe("link destination encoding", () => {
  it("writes ordinary addresses bare and keeps query ampersands readable", () => {
    expect(encodeMarkdownDestination("https://quirekit.com")).toBe("https://quirekit.com");
    expect(encodeMarkdownDestination("https://x.dev/?a=1&b=2")).toBe("https://x.dev/?a=1&b=2");
    expect(encodeMarkdownDestination("./中文.md#标题")).toBe("./中文.md#标题");
  });

  it("brackets addresses that a bare destination cannot hold", () => {
    expect(encodeMarkdownDestination("my file (1).md")).toBe("<my file (1).md>");
    expect(encodeMarkdownDestination("a\\b")).toBe("<a\\\\b>");
    expect(encodeMarkdownDestination("")).toBe("<>");
  });

  it("round-trips through the destination decoder", () => {
    for (const url of ["https://x.dev/?a=1&b=2", "https://x.dev/?q=&amp;", "my file (1).md", "a<b>c", "a\\b", "https://x.dev/&copy;"]) {
      const encoded = encodeMarkdownDestination(url);
      const raw = encoded.startsWith("<") ? encoded.slice(1, -1) : encoded;
      expect(decodeMarkdownDestination(raw), url).toBe(decodeMarkdownDestination(url.replace(/[\\&<>]/gu, ch => `\\${ch}`)));
    }
  });
});
