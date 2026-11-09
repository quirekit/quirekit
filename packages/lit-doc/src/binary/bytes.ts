import { requireDoc } from '../errors'
import type { DocReadErrorCode } from '../types'

/** A little-endian view whose offsets always refer to the supplied byte slice. */
export class ByteView {
  /** Bytes belonging to this stream only. */
  readonly bytes: Uint8Array
  private readonly view: DataView
  private readonly code: DocReadErrorCode

  /**
   * Creates a stream-relative reader.
   * @param bytes - Stream bytes, possibly a nonzero-offset slice.
   * @param code - Failure category for malformed offsets.
   */
  constructor(bytes: Uint8Array, code: DocReadErrorCode) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.code = code
  }

  /**
   * Checks a span without overflowing its endpoint.
   * @param offset - Stream-relative byte position.
   * @param length - Required byte count.
   */
  check(offset: number, length: number): void {
    requireDoc(Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0
      && offset <= this.bytes.length && length <= this.bytes.length - offset,
    this.code, `Byte range ${offset}+${length} exceeds stream length ${this.bytes.length}`)
  }

  /**
   * Reads one byte.
   * @param offset - Stream-relative position.
   * @returns Unsigned byte value.
   */
  u8(offset: number): number { this.check(offset, 1); return this.view.getUint8(offset) }

  /**
   * Reads one little-endian word.
   * @param offset - Stream-relative position.
   * @returns Unsigned 16-bit value.
   */
  u16(offset: number): number { this.check(offset, 2); return this.view.getUint16(offset, true) }

  /**
   * Reads one little-endian double word.
   * @param offset - Stream-relative position.
   * @returns Unsigned 32-bit value.
   */
  u32(offset: number): number { this.check(offset, 4); return this.view.getUint32(offset, true) }

  /**
   * Creates a bounded view without normalizing any bytes.
   * @param offset - Stream-relative start.
   * @param length - Span length.
   * @returns Borrowed byte slice.
   */
  slice(offset: number, length: number): Uint8Array {
    this.check(offset, length)
    return this.bytes.subarray(offset, offset + length)
  }
}
