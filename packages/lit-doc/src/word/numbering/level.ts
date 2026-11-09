import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import type { DocNumberingLevel, NumberingBudget } from './types'

/**
 * Reads one complete source level without executing its opaque property payloads.
 * @param bytes - Bounded owning definition or instance tail.
 * @param at - Position relative to those bytes.
 * @param index - Actual source level identity.
 * @param hybrid - Whether tentative flags are meaningful.
 * @param budget - Shared level and string-allocation ceilings.
 * @returns Level and exclusive next record offset.
 */
export function readNumberingLevel(bytes: Uint8Array, at: number, index: number, hybrid: boolean,
  budget: NumberingBudget): { level: DocNumberingLevel; end: number } {
  budget.consumeLevel()
  const view = new ByteView(bytes, 'invalid-numbering-data')
  view.check(at, 28)
  const rawStartAt = view.u32(at) | 0
  const numberFormat = view.u8(at + 4)
  const flags = view.u8(at + 5)
  const sequence = numberFormat !== 0x17 && numberFormat !== 0xff
  requireDoc(![8, 9, 15, 19].includes(numberFormat), 'invalid-numbering-data', 'Reserved numbering format')
  requireDoc(!sequence || rawStartAt >= 0 && rawStartAt <= 0x7fff, 'invalid-numbering-data', 'Invalid numbering start')
  requireDoc((flags & 3) <= 2, 'invalid-numbering-data', 'Invalid numbering alignment')
  const suffix = view.u8(at + 15)
  requireDoc(suffix <= 2, 'invalid-numbering-data', 'Invalid numbering suffix')
  const savedIndentTwips = flags & 0x10 ? view.u32(at + 16) | 0 : null
  requireDoc(savedIndentTwips === null || Math.abs(savedIndentTwips) <= 31680,
    'invalid-numbering-data', 'Invalid saved numbering indentation')
  const restartLimit = sequence && flags & 8 ? view.u8(at + 26) : null
  requireDoc(restartLimit === null || restartLimit <= index, 'invalid-numbering-data', 'Invalid numbering restart level')

  // Property envelopes precede Xst. Copy only after their complete declared span
  // is bounded; later semantic projection must use the common interpreters.
  const paragraphLength = view.u8(at + 25)
  const characterLength = view.u8(at + 24)
  const textAt = at + 28 + paragraphLength + characterLength
  const count = view.u16(textAt)
  view.check(textAt + 2, count * 2)
  budget.consumeText(count)
  const template = readUtf16Units(view, textAt + 2, count)
  const placeholderOffsets: number[] = []
  for (let item = 0; item < 9; item++) {
    const position = view.u8(at + 6 + item)
    if (!position) break
    requireDoc(position > (placeholderOffsets.at(-1) ?? 0) && position <= count
      && template.charCodeAt(position - 1) <= index, 'invalid-numbering-data', 'Invalid numbering placeholder')
    placeholderOffsets.push(position)
  }
  requireDoc(placeholderOffsets.length <= index + 1 && (numberFormat !== 0x17 || count === 1 && !placeholderOffsets.length),
    'invalid-numbering-data', 'Invalid bullet or level placeholder count')
  return { end: textAt + 2 + count * 2, level: {
    index, rawStartAt, startAt: sequence ? rawStartAt : null, numberFormat, alignment: flags & 3,
    legal: !!(flags & 4), restartLimit, savedIndentTwips, converted: !!(flags & 0x20),
    tentative: hybrid ? !!(flags & 0x80) : null, suffix, htmlFlags: view.u8(at + 27), template, placeholderOffsets,
    paragraphProperties: view.slice(at + 28, paragraphLength).slice(),
    characterProperties: view.slice(at + 28 + paragraphLength, characterLength).slice(), headerBytes: view.slice(at, 28).slice(),
  } }
}
