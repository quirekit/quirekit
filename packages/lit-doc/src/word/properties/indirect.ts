/**
 * Borrows an actual complete PrcData group without interpreting its property bytes.
 * @param offset - Signed source Data-stream offset.
 * @param data - Optional original Data stream, possibly a nonzero-offset slice.
 * @returns Exact group bytes, including an empty group, or undefined for an unavailable reference.
 */
export function readIndirectPropertyGroup(offset: number, data: Uint8Array | undefined): Uint8Array | undefined {
  // Check by subtraction before reading the signed prefix. Neither a large
  // offset nor an unsigned interpretation of a negative size can authorize bytes.
  if (!data || !Number.isSafeInteger(offset) || offset < 0 || offset > 0x7fffffff || offset > data.length - 2) return undefined
  const length = new DataView(data.buffer, data.byteOffset, data.byteLength).getInt16(offset, true)
  if (length < 0 || length > 0x3fa2 || length > data.length - offset - 2) return undefined
  return data.subarray(offset + 2, offset + 2 + length)
}
