const TWO_32 = 4294967296;

/**
 * Hashes Markdown source as FNV-1a 64 over its UTF-8 bytes, so any host language can reproduce it.
 * Bytes are produced inline instead of through TextEncoder to avoid copying large documents;
 * lone surrogates encode as U+FFFD, matching TextEncoder.
 * @param source - Markdown source.
 * @returns `fnv1a64:` followed by 16 lowercase hex digits.
 */
export function hashCommentSource(source: string): string {
  // 64-bit state as two exact 32-bit halves; every intermediate product stays below 2^53.
  let hi = 0xcbf29ce4, lo = 0x84222325;
  /** @param value - One UTF-8 byte folded into the state. */
  const byte = (value: number): void => {
    lo = (lo ^ value) >>> 0;
    // Prime 0x100_000001b3 = 256 * 2^32 + 0x1b3.
    const low = lo * 0x1b3;
    hi = (hi * 0x1b3 + lo * 0x100 + Math.floor(low / TWO_32)) % TWO_32;
    lo = low % TWO_32;
  };
  for (let index = 0; index < source.length; index++) {
    let point = source.charCodeAt(index);
    if (point >= 0xd800 && point <= 0xdbff) {
      const next = source.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { point = 0x10000 + (point - 0xd800) * 0x400 + (next - 0xdc00); index++; }
      else point = 0xfffd;
    } else if (point >= 0xdc00 && point <= 0xdfff) point = 0xfffd;
    if (point < 0x80) byte(point);
    else if (point < 0x800) { byte(0xc0 | point >> 6); byte(0x80 | point & 0x3f); }
    else if (point < 0x10000) { byte(0xe0 | point >> 12); byte(0x80 | point >> 6 & 0x3f); byte(0x80 | point & 0x3f); }
    else { byte(0xf0 | point >> 18); byte(0x80 | point >> 12 & 0x3f); byte(0x80 | point >> 6 & 0x3f); byte(0x80 | point & 0x3f); }
  }
  return `fnv1a64:${hi.toString(16).padStart(8, "0")}${lo.toString(16).padStart(8, "0")}`;
}
