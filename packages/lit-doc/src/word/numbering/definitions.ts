import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordRecordRange } from '../types'
import { readNumberingLevel } from './level'
import type { DocNumberingDefinition, DocNumberingLevel, NumberingBudget } from './types'

/**
 * Reads the fixed definition array followed by its separately counted levels.
 * @param table - Complete source Table stream.
 * @param range - FIB locator whose length excludes appended levels.
 * @param limits - Validated definition allocation ceiling.
 * @param budget - Shared level and text ceilings.
 * @returns Definitions and exclusive end of their appended source levels.
 */
export function readNumberingDefinitions(table: Uint8Array, range: WordRecordRange, limits: DocReadLimits,
  budget: NumberingBudget): { definitions: DocNumberingDefinition[]; end: number } {
  if (!range.length) return { definitions: [], end: range.offset }
  const view = new ByteView(table, 'invalid-numbering-data')
  view.check(range.offset, range.length)
  const count = view.u16(range.offset)
  requireDoc(count <= 0x7fff, 'invalid-numbering-data', 'Invalid signed numbering definition count')
  requireDoc(count <= limits.maxNumberingDefinitions, 'limit-exceeded', 'Numbering definition limit exceeded')
  requireDoc(range.length === 2 + count * 28, 'invalid-numbering-data', 'Invalid numbering definition array length')
  const definitions: DocNumberingDefinition[] = []
  const identities = new Set<number>()
  let end = range.offset + range.length
  for (let index = 0; index < count; index++) {
    const at = range.offset + 2 + index * 28
    const sourceId = view.u32(at) | 0
    requireDoc(sourceId !== -1 && !identities.has(sourceId), 'invalid-numbering-data', 'Invalid or duplicate numbering identity')
    identities.add(sourceId)
    const flags = view.u8(at + 26)
    const simple = !!(flags & 1)
    const hybrid = !!(flags & 0x10)
    const styleIndexes = Array.from({ length: 9 }, (_, item) => view.u16(at + 8 + item * 2))
    requireDoc(styleIndexes.every(style => style <= 0x0fff), 'invalid-numbering-data', 'Invalid linked numbering style index')
    const levels: DocNumberingLevel[] = []
    for (let level = 0; level < (simple ? 1 : 9); level++) {
      const result = readNumberingLevel(table, end, level, hybrid, budget)
      levels.push(result.level); end = result.end
    }
    definitions.push({ sourceId, templateCode: view.u32(at + 4), styleIndexes, simple, autoNumbered: !!(flags & 4),
      hybrid, htmlFlags: view.u8(at + 27), levels, headerBytes: view.slice(at, 28).slice() })
  }
  return { definitions, end }
}
