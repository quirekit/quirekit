import { compoundFixture } from '../compound'
import { withCharacterRecords } from '../characters'
import { conversionRecords } from '../conversion'
import { operation, withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { wordStreams } from '../word'
import { tableDefinition } from './definition'

const outer = [...operation(0x2416, 1), ...operation(0x6649, 1, 0, 0, 0)]
const inner = [...operation(0x2416, 1), ...operation(0x6649, 2, 0, 0, 0)]

/**
 * Encodes source FC spans independently of the paragraph markers inside them.
 * @param text - Exact original code units, including the main-story guard.
 * @param spans - Explicit physical record endings and original properties.
 * @param start - First actually covered character position, preserving a possible gap.
 * @returns Complete conversion sources before compound-file encoding.
 */
function streams(text: string, spans: readonly { end: number, properties: readonly number[] }[], start = 0): Record<string, Uint8Array> {
  const units = Array.from({ length: text.length }, (_, index) => text.charCodeAt(index))
  const paragraphs = withParagraphRecords(wordStreams([{ units, unicode: false }]), [{
    cuts: [2048 + start, ...spans.map(span => 2048 + span.end)],
    records: spans.map(span => ({ bytes: span.properties, odd: span.properties.length % 2 === 1 })),
  }])
  const characters = withCharacterRecords(paragraphs, [{ cuts: [2048, 2048 + text.length], records: [[]] }])
  return conversionRecords(withStyleDefinitions(characters, [{ index: 0 }]), text.length)
}

/**
 * Wraps the three original PAPX intervals with a separate final story guard when needed.
 * @param kind - Original nested-cell, row-end or uncovered-paragraph case.
 * @returns Exact property intervals and code units for source-level assertions.
 */
export function paragraphBoundaryStreams(kind: 'nested-cell' | 'row-end' | 'missing'): Record<string, Uint8Array> {
  if (kind === 'missing') return streams('A\rB\r', [{ end: 4, properties: operation(0x2403, 1) }], 2)
  if (kind === 'nested-cell') return streams('A\r\r\r', [
    { end: 3, properties: [...inner, ...operation(0x244b, 1)] }, { end: 4, properties: [] },
  ])
  return streams('A\r\u0007\r', [
    { end: 3, properties: [...operation(0x2416, 1), ...operation(0x2417, 1), ...operation(0x2403, 1)] },
    { end: 4, properties: [] },
  ])
}

/**
 * Builds complete products with shared row/cell PAPX or a genuinely uncovered paragraph.
 * @param kind - Complete nested-cell, outer-row or absent-PAPX scenario.
 * @returns Independently encoded DOC suitable for actual codec and Classic verification.
 */
export function tableBoundaryDocument(kind: 'nested-cell' | 'row-end' | 'missing' | 'definition'): Uint8Array {
  if (kind === 'missing') return compoundFixture(paragraphBoundaryStreams(kind))
  if (kind === 'definition') {
    const original = tableDefinition([-108, 851, 4960], [{ flags: 0x600, width: 959 }, { flags: 0x600, width: 4109 }])
    original[2] = original[2]! - 1
    return compoundFixture(streams('A\u0007B\u0007\u0007\r', [
      { end: 2, properties: outer }, { end: 4, properties: outer },
      { end: 5, properties: [...outer, ...operation(0x2417, 1), ...original] }, { end: 6, properties: [] },
    ]))
  }
  const definition = tableDefinition([0, 1440])
  if (kind === 'row-end') return compoundFixture(streams('A\rB\u0007\u0007\r', [
    { end: 5, properties: [...outer, ...operation(0x2417, 1), ...operation(0x2403, 1), ...definition] },
    { end: 6, properties: [] },
  ]))
  return compoundFixture(streams('A\r\r\rX\u0007\u0007\r', [
    { end: 3, properties: [...inner, ...operation(0x244b, 1)] },
    { end: 4, properties: [...inner, ...operation(0x244c, 1), ...definition] },
    { end: 6, properties: outer },
    { end: 7, properties: [...outer, ...operation(0x2417, 1), ...definition] },
    { end: 8, properties: [] },
  ]))
}
