import { compoundFixture } from './compound'
import { conversionRecords } from './conversion'
import { withCharacterRecords } from './characters'
import { operation, withStyleDefinitions } from './formatting'
import { withParagraphRecords } from './paragraphs'
import { wordStreams } from './word'

/**
 * Encodes a complete DOC whose first paragraph exercises local property recovery.
 * @param kind - Original truncated-list boundary or indirect paragraph opcode.
 * @returns Independent source bytes with authored center alignment and keep-next when available.
 */
export function propertyRecoveryDocument(kind: 'variable' | 'tabs' | 'missing-data' | 'section' | 0x6645 | 0x6646): Uint8Array {
  const fields = [...operation(0x2403, 1), ...operation(0x2406, 1)]
  const indirect = typeof kind === 'number' || kind === 'missing-data'
  const direct = indirect ? [...operation(typeof kind === 'number' ? kind : 0x6646, 0, 0, 0, 0),
    ...(kind === 'missing-data' ? fields : [])]
    : [...fields, ...(kind === 'section' ? [] : kind === 'tabs' ? [0x15, 0xc6, 0x10] : [0x1d, 0xc6])]
  const paragraphs = withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: direct, odd: direct.length % 2 === 1 }],
  }])
  const characters = withCharacterRecords(paragraphs, [{ cuts: [2048, 2050], records: [[]] }])
  const streams = conversionRecords(withStyleDefinitions(characters, [{ index: 0 }, { index: 15, parent: 0 }]), 2)
  if (typeof kind === 'number') streams.Data = Uint8Array.from([fields.length, 0, ...fields])
  if (kind === 'section') {
    const word = streams.WordDocument!, table = streams['1Table']!
    const fib = new DataView(word.buffer)
    const section = fib.getUint32(154 + 6 * 8, true)
    const oldOffset = new DataView(table.buffer).getUint32(section + 10, true)
    const original = word.subarray(oldOffset + 2, oldOffset + 2 + fib.getUint16(oldOffset, true))
    const properties = Uint8Array.from([...original, 0x00, 0x30, 1, 0x01, 0x50, 2])
    const expanded = new Uint8Array(word.length + properties.length + 2)
    expanded.set(word)
    const view = new DataView(expanded.buffer)
    view.setUint16(word.length, properties.length, true)
    expanded.set(properties, word.length + 2)
    view.setUint32(64, expanded.length, true)
    new DataView(table.buffer).setUint32(section + 10, word.length, true)
    streams.WordDocument = expanded
  }
  return compoundFixture(streams)
}
