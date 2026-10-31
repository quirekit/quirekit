import { describe, expect, it } from "vitest";
import { hashCommentSource } from "./hash";

/** @param source - Text. @returns Reference FNV-1a 64 over TextEncoder bytes, computed with BigInt. */
function reference(source: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(source)) hash = (hash ^ BigInt(byte)) * 0x100000001b3n & 0xffffffffffffffffn;
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

describe("source hash", () => {
  it("matches published FNV-1a 64 vectors", () => {
    expect(hashCommentSource("")).toBe("fnv1a64:cbf29ce484222325");
    expect(hashCommentSource("a")).toBe("fnv1a64:af63dc4c8601ec8c");
    expect(hashCommentSource("foobar")).toBe("fnv1a64:85944171f73967e8");
  });

  it("hashes UTF-8 bytes like TextEncoder, including astral and lone surrogates", () => {
    for (const source of ["中文 Markdown", "emoji 😀 end", "lone \ud83d here", "tail \udc00", "é\r\n\t", "😀".repeat(40)]) {
      expect(hashCommentSource(source)).toBe(reference(source));
    }
  });
});
