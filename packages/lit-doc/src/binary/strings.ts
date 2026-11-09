import type { ByteView } from './bytes'

/**
 * Decodes exact source UTF-16 units without BOM stripping or surrogate replacement.
 * @param source - Already bounded little-endian record view.
 * @param offset - First source code unit's byte offset.
 * @param count - Exact code-unit count from the owning structure.
 * @returns Source string, retaining every code unit for later XML validation.
 */
export function readUtf16Units(source: ByteView, offset: number, count: number): string {
  source.check(offset, count * 2)
  const chunks: string[] = []
  for (let start = 0; start < count; start += 4096) {
    const units = Array.from({ length: Math.min(4096, count - start) }, (_, i) => source.u16(offset + (start + i) * 2))
    chunks.push(String.fromCharCode(...units))
  }
  return chunks.join('')
}
