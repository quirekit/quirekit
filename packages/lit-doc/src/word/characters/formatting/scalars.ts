import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { DocReadDiagnostic } from '../../../types'
import type { PropertyOperation } from '../../properties/types'
import type { DocCharacterBaseFormat } from '../types'
import type { CharacterPropertyKey } from './types'

const underlines = new Set([0, 1, 2, 3, 4, 6, 7, 9, 10, 11, 20, 23, 25, 26, 27, 39, 43, 55])
const fonts = new Map<number, 'ascii' | 'eastAsia' | 'other' | 'complex'>([[0x4a4f, 'ascii'], [0x4a50, 'eastAsia'], [0x4a51, 'other'], [0x4a5e, 'complex']])
const languages = new Map<number, 'language' | 'languageEastAsia' | 'languageComplex'>([
  [0x486d, 'language'], [0x4873, 'language'], [0x486e, 'languageEastAsia'], [0x4874, 'languageEastAsia'], [0x485f, 'languageComplex'],
])
const notedZeroSize = new WeakSet<DocReadDiagnostic[]>()

/**
 * Applies admitted scalar values without converting source units or selecting fonts.
 * @param target - Independent current settings.
 * @param operation - One validated property envelope.
 * @param diagnostics - Optional inspection-owned compatibility sink.
 * @returns Written semantic field, or undefined for a different operation.
 */
export function applyCharacterScalar(target: DocCharacterBaseFormat, operation: PropertyOperation, diagnostics?: DocReadDiagnostic[]): CharacterPropertyKey | undefined {
  const { opcode, operand } = operation
  const source = new ByteView(operand, 'invalid-formatting-data')
  const font = fonts.get(opcode)
  const language = languages.get(opcode)
  if (font) { target.fontIndexes[font] = integer(source.u16(0), 0, 0x7fff); return `font:${font}` }
  if (language) { target[language] = source.u16(0); return language }
  if (opcode === 0x4a43) {
    const value = source.u16(0)
    target.fontSizeHalfPoints = value === 0 ? 0 : integer(value, 2, 3276)
    if (value === 0 && diagnostics && !notedZeroSize.has(diagnostics)) {
      notedZeroSize.add(diagnostics)
      diagnostics.push({ code: 'legacy-zero-font-size', message: 'An explicit legacy ordinary font size of zero is retained as stored; portable Word-compatible rendering remains unsupported.' })
    }
    return 'fontSizeHalfPoints'
  }
  if (opcode === 0x4a61) { target.fontSizeComplexHalfPoints = integer(source.u16(0), 0, 3276); return 'fontSizeComplexHalfPoints' }
  if (opcode === 0x2a3e) {
    requireDoc(underlines.has(source.u8(0)), 'invalid-formatting-data', 'Invalid underline kind')
    target.underline = source.u8(0)
    return 'underline'
  }
  if (opcode === 0x2a48) { target.verticalAlign = integer(source.u8(0), 0, 2); return 'verticalAlign' }
  if (opcode === 0x2a34) { target.emphasis = integer(source.u8(0), 0, 4); return 'emphasis' }
  if (opcode === 0x8840) { target.spacingTwips = integer(signed(source.u16(0)), -31680, 31680); return 'spacingTwips' }
  if (opcode === 0x4845) { target.positionHalfPoints = integer(signed(source.u16(0)), -3168, 3168); return 'positionHalfPoints' }
  if (opcode === 0x4852) { target.scalePercent = integer(source.u16(0), 1, 600); return 'scalePercent' }
  if (opcode === 0x484b) { target.kerningHalfPoints = integer(source.u16(0), 0, 3276); return 'kerningHalfPoints' }
  if (opcode === 0x286f) {
    requireDoc([0, 1, 2, 255].includes(source.u8(0)), 'invalid-formatting-data', 'Invalid character script hint')
    target.scriptHint = source.u8(0)
    return 'scriptHint'
  }
  if (opcode === 0x2a0c) { target.highlight = integer(source.u8(0), 0, 16); return 'highlight' }
  if (opcode === 0x2a42) { target.color = { encoding: 'palette', value: integer(source.u8(0), 0, 16) }; return 'color' }
  if (opcode === 0x4a60) { target.colorComplex = integer(source.u16(0), 0, 16); return 'colorComplex' }
  if (opcode === 0x6870) { target.color = { encoding: 'colorref', value: colorRef(source.u32(0)) }; return 'color' }
  if (opcode === 0x6877) { target.underlineColorRef = colorRef(source.u32(0)); return 'underlineColorRef' }
  return undefined
}

/**
 * Validates a normative scalar interval.
 * @param value - Original signed or unsigned value.
 * @param minimum - Inclusive lower bound.
 * @param maximum - Inclusive upper bound.
 * @returns Validated value.
 */
function integer(value: number, minimum: number, maximum: number): number {
  requireDoc(value >= minimum && value <= maximum, 'invalid-formatting-data', 'Character property is outside its valid range')
  return value
}

/**
 * Decodes a signed sixteen-bit source value.
 * @param value - Unsigned stored word.
 * @returns Signed value.
 */
function signed(value: number): number { return value >= 0x8000 ? value - 0x10000 : value }

/**
 * Validates the automatic-color byte while retaining the complete original value.
 * @param value - Unsigned COLORREF.
 * @returns Exact source color.
 */
function colorRef(value: number): number {
  requireDoc(value >>> 24 === 0 || value >>> 24 === 255, 'invalid-formatting-data', 'Invalid automatic color flag')
  return value
}
