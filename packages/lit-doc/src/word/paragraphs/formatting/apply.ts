import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { DocParagraphBaseFormat } from '../../../types'
import type { PropertyOperation, PropertyReader } from '../../properties/types'
import type { ParagraphNumberingState } from '../../numbering/types'
import type { ParagraphPropertyKey, ParagraphStyleResolver } from './types'
import { applyTabOperation } from './tabs'
import { validateLegacyNumberingDescriptor } from './legacy-numbering'
import { replaceParagraphStyle } from './reset'
import { modernShadingSegments, readDocShading } from '../../formatting/shading/read'

// These paragraph modifiers affect fields outside the declared base-settings
// projection. Their identity remains visible; compound resets are rejected below.
const outsideScope = new Set([0x260a, 0x460b, 0x240c, 0xc60d, 0xc615, 0x2416, 0x2417,
  0x8418, 0x8419, 0x841a, 0x261b, 0x2423, 0x6424, 0x6425, 0x6426, 0x6427, 0x6428,
  0x6629, 0x242a, 0x442b, 0x442c, 0x842e, 0x842f, 0x2430, 0x2433, 0x2434,
  0x2435, 0x2436, 0x4439, 0x443a, 0x2443, 0xc645, 0x6646,
  0x2447, 0x2448, 0x6649, 0x664a, 0x244b, 0x244c, 0xc64e, 0xc64f, 0xc650,
  0xc651, 0xc652, 0xc653, 0x6654, 0x4455, 0x4456, 0x4457, 0x4458, 0x4459, 0x245a, 0x245b,
  0x245c, 0x2462, 0x2664, 0x6465, 0xc666, 0x6467, 0xc669, 0xc66c, 0x246d, 0xc66f, 0x2470, 0x2471])
const booleans = new Map<number, 'keepLines' | 'keepNext' | 'pageBreakBefore' | 'widowControl' | 'bidi' | 'autoSpaceLatin' | 'autoSpaceNumber'>([
  [0x2405, 'keepLines'], [0x2406, 'keepNext'], [0x2407, 'pageBreakBefore'], [0x2431, 'widowControl'], [0x2441, 'bidi'],
  [0x2437, 'autoSpaceLatin'], [0x2438, 'autoSpaceNumber'],
])

/**
 * Applies only the admitted base fields and records every other encountered property.
 * @param format - Independent settings being updated in source order.
 * @param operations - Ordered style, PAPX or piece operations.
 * @param reader - Common execution budget.
 * @param fields - Optional sink recording directly written semantic fields.
 * @param numbering - Optional raw reference state, captured in this same ordered traversal.
 * @param styles - Optional style authority available only for direct paragraph operations.
 */
export function applyParagraphProperties(format: DocParagraphBaseFormat, operations: readonly PropertyOperation[], reader: PropertyReader,
  fields?: Set<ParagraphPropertyKey>, numbering?: ParagraphNumberingState, styles?: ParagraphStyleResolver): void {
  reader.consume(operations.length)
  const unsupported = new Set(format.unsupportedOpcodes)
  const modernShading = modernShadingSegments(operations); let segment = 0
  for (const operation of operations) {
    const { opcode, operand } = operation
    const value = new ByteView(operand, 'invalid-formatting-data')
    if (numbering && opcode === 0x460b) { numbering.rawIndex = value.u16(0); numbering.referenceChanged = true }
    if (numbering && opcode === 0x260a) { numbering.rawLevel = value.u8(0); numbering.levelChanged = true }
    const boolean = booleans.get(opcode)
    if (opcode === 0x4600) {
      segment++
      requireDoc(styles, 'unsupported-formatting', 'Paragraph style replacement requires a direct paragraph source')
      replaceParagraphStyle(format, value.u16(0), styles, fields, numbering)
      for (const code of format.unsupportedOpcodes) unsupported.add(code)
    } else if (opcode === 0xc60d || opcode === 0xc615) {
      format.tabs = applyTabOperation(format.tabs, operation, reader)
      fields?.add('tabs')
    } else if (opcode === 0xc63e) {
      validateLegacyNumberingDescriptor(operand)
      unsupported.add(opcode)
    } else if (opcode === 0x442d || opcode === 0xc64d) {
      // Complete RGB shading wins over same-layer palette compatibility data.
      // A style replacement or later source layer starts a new authority.
      const shading = readDocShading(operation)
      if (opcode === 0xc64d || !modernShading.has(segment)) { format.shading = shading; fields?.add('shading') }
    } else if (opcode === 0x2404) {
      requireDoc(value.u8(0) <= 1, 'invalid-formatting-data', 'Invalid legacy side-by-side paragraph flag')
      unsupported.add(opcode)
    } else if (boolean) {
      requireDoc(value.u8(0) <= 1, 'invalid-formatting-data', 'Invalid paragraph Boolean operand')
      format[boolean] = value.u8(0) === 1
      fields?.add(boolean)
    } else if (opcode === 0x2640) {
      requireDoc(value.u8(0) <= 9, 'invalid-formatting-data', 'Invalid paragraph outline level')
      format.outlineLevel = value.u8(0)
      fields?.add('outlineLevel')
    } else if (opcode === 0x2403 || opcode === 0x2461) {
      requireDoc(value.u8(0) <= (opcode === 0x2403 ? 5 : 9), 'invalid-formatting-data', 'Invalid paragraph justification')
      format.alignment = { value: value.u8(0), logical: opcode === 0x2461 }
      fields?.add('alignment')
    } else if ([0x840e, 0x840f, 0x8411, 0x845d, 0x845e, 0x8460].includes(opcode)) {
      fields?.add(opcode === 0x8411 || opcode === 0x8460 ? 'firstLineIndentTwips' : opcode === 0x840e || opcode === 0x845d ? 'rightIndent' : 'leftIndent')
      const twips = signedDistance(value.u16(0))
      if (opcode === 0x8411 || opcode === 0x8460) format.firstLineIndentTwips = twips
      else if (opcode === 0x840e || opcode === 0x845d) format.rightIndent = { twips, logical: opcode === 0x845d }
      else format.leftIndent = { twips, logical: opcode === 0x845e }
    } else if (opcode === 0xa413 || opcode === 0xa414) {
      fields?.add(opcode === 0xa413 ? 'spacingBeforeTwips' : 'spacingAfterTwips')
      const twips = value.u16(0)
      requireDoc(twips <= 31680, 'invalid-formatting-data', 'Paragraph spacing is outside its valid range')
      if (opcode === 0xa413) format.spacingBeforeTwips = twips
      else format.spacingAfterTwips = twips
    } else if (opcode === 0x6412) {
      requireDoc(value.u16(2) <= 1, 'invalid-formatting-data', 'Invalid line-spacing multiplier flag')
      format.lineSpacing = { value: signedDistance(value.u16(0)), multiple: value.u16(2) === 1 }
      fields?.add('lineSpacing')
    } else {
      const group = (opcode >>> 10) & 7
      requireDoc(group >= 1 && group <= 5 && (group !== 1 || outsideScope.has(opcode)),
        'unsupported-formatting', `Unsupported paragraph formatting operation 0x${opcode.toString(16)}`)
      unsupported.add(opcode)
    }
  }
  format.unsupportedOpcodes = [...unsupported].sort((a, b) => a - b)
}

/**
 * Interprets a signed Word distance without allowing reserved numeric ranges.
 * @param value - Unsigned 16-bit storage value.
 * @returns Signed twips within the normative range.
 */
function signedDistance(value: number): number {
  const signed = value >= 0x8000 ? value - 0x10000 : value
  requireDoc(Math.abs(signed) <= 31680, 'invalid-formatting-data', 'Paragraph distance is outside its valid range')
  return signed
}
