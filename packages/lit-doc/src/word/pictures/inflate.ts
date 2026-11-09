import { Unzlib } from 'fflate'
import { DocReadError, requireDoc } from '../../errors'

/**
 * Decodes zlib in bounded input chunks and verifies the declared output and Adler checksum.
 * @param bytes - Exact compressed payload including its zlib envelope.
 * @param size - Already budgeted expected output length.
 * @returns Complete decoded bytes or an explicit corruption/expansion failure.
 */
export function inflatePicture(bytes: Uint8Array, size: number): Uint8Array {
  requireDoc(bytes.length >= 6, 'invalid-picture-data', 'Truncated compressed picture')
  const output = new Uint8Array(size)
  let offset = 0
  let first = 1
  let second = 0
  let completed = false
  const inflater = new Unzlib((chunk, final) => {
    requireDoc(chunk.length <= size - offset, 'limit-exceeded', 'Picture expands beyond its declared decoded size')
    output.set(chunk, offset)
    offset += chunk.length
    for (const byte of chunk) {
      first = (first + byte) % 65521
      second = (second + first) % 65521
    }
    completed = final
  })
  try {
    // A bounded compressed chunk also bounds temporary output before the next
    // callback, even when the stored uncompressed length is dishonest.
    for (let position = 0; position < bytes.length; position += 1024)
      inflater.push(bytes.subarray(position, position + 1024), position + 1024 >= bytes.length)
  } catch (error) {
    if (error instanceof DocReadError) throw error
    if (!(error instanceof Error) || !('code' in error) || ![0, 1, 2, 3, 6].includes(error.code as number)) throw error
    requireDoc(false, 'invalid-picture-data', 'Invalid compressed picture stream')
  }
  requireDoc(completed && offset === size, 'invalid-picture-data', 'Decoded picture length disagrees with its header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  requireDoc(((second << 16 | first) >>> 0) === view.getUint32(bytes.length - 4),
    'invalid-picture-data', 'Compressed picture checksum mismatch')
  return output
}
