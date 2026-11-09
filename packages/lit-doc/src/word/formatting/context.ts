import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import { createPropertyReader } from '../properties/reader'
import { readWordStyles } from '../styles/read'
import { readFontRecords } from '../fonts/read'
import type { WordFontRecord } from '../fonts/types'
import type { WordHeader } from '../types'
import type { WordFormattingContext } from './types'

/**
 * Creates shared immutable sources and one budget for all requested formatting passes.
 * @param table - Selected Table stream.
 * @param data - Optional Data stream.
 * @param header - Validated FIB locators.
 * @param limits - Shared work and allocation ceilings.
 * @param characters - Whether to read character defaults and validate combined index allocation.
 * @param recover - Whether rich conversion permits local structural-property recovery.
 * @returns Shared formatting context.
 */
export function createFormattingContext(table: Uint8Array, data: Uint8Array | undefined, header: WordHeader,
  limits: DocReadLimits, characters: boolean, recover = false): WordFormattingContext {
  let fonts
  if (characters) {
    const indexes = [header.records[12]!, header.records[13]!]
    requireDoc(indexes.every(range => range.length >= 12 && (range.length - 4) % 8 === 0),
      'invalid-formatting-data', 'Missing or invalid character/paragraph formatting index')
    requireDoc(indexes.reduce((sum, range) => sum + (range.length - 4) / 8, 0) <= limits.maxFormattingPages,
      'limit-exceeded', 'Combined formatting page limit exceeded')
    const range = header.records[1]!
    const view = new ByteView(new ByteView(table, 'invalid-formatting-data').slice(range.offset, range.length), 'invalid-formatting-data')
    fonts = { ascii: view.u16(14), eastAsia: view.u16(16), other: view.u16(18), complex: view.u16(0) >= 20 ? view.u16(20) : null }
    requireDoc(Object.values(fonts).every(value => value === null || value <= 0x7fff),
      'invalid-formatting-data', 'Negative default font index')
  }
  const source = readWordStyles(table, header)
  const diagnostics = [...source.diagnostics]
  let names: readonly WordFontRecord[] | undefined
  /** @param index - Original font-table slot. @returns Declared source primary name without choosing an installed font. */
  function fontName(index: number): string {
    if (!names) {
      const range = header.records[15]!
      names = readFontRecords(new ByteView(table, 'invalid-formatting-data').slice(range.offset, range.length))
    }
    requireDoc(names[index], 'invalid-formatting-data', 'Character font slot points outside the source font table')
    return names[index].name
  }
  return { recoverProperties: recover, styles: source.styles, diagnostics, fonts, reader: createPropertyReader(data, limits, diagnostics, recover), fontName }
}
