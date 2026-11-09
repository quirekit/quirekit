import { requireDoc } from '../errors'

// FcCompressed supplies this limited remapping; undefined C1 bytes remain controls.
const compressedMappings = new Map<number, number>([
  [0x82, 0x201a], [0x83, 0x192], [0x84, 0x201e], [0x85, 0x2026], [0x86, 0x2020], [0x87, 0x2021],
  [0x88, 0x2c6], [0x89, 0x2030], [0x8a, 0x160], [0x8b, 0x2039], [0x8c, 0x152],
  [0x91, 0x2018], [0x92, 0x2019], [0x93, 0x201c], [0x94, 0x201d], [0x95, 0x2022],
  [0x96, 0x2013], [0x97, 0x2014], [0x98, 0x2dc], [0x99, 0x2122], [0x9a, 0x161],
  [0x9b, 0x203a], [0x9c, 0x153], [0x9f, 0x178],
])

/**
 * Decodes source code units without BOM removal, replacement, or newline normalization.
 * @param bytes - One previously bounded text span.
 * @param unicode - Whether the source uses 16-bit little-endian units.
 * @returns Exact logical code units.
 */
export function decodeTextSpan(bytes: Uint8Array, unicode: boolean): string {
  requireDoc(!unicode || bytes.length % 2 === 0, 'invalid-text-map', 'Incomplete UTF-16 code unit')
  const width = unicode ? 2 : 1
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: string[] = []
  for (let start = 0; start < bytes.length; start += 4096 * width) {
    const units: number[] = []
    const end = Math.min(bytes.length, start + 4096 * width)
    for (let offset = start; offset < end; offset += width) {
      const value = unicode ? view.getUint16(offset, true) : view.getUint8(offset)
      units.push(unicode ? value : compressedMappings.get(value) ?? value)
    }
    parts.push(String.fromCharCode(...units))
  }
  return parts.join('')
}
