import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadDiagnostic, DocReadLimits } from '../../types'
import { readIndirectPropertyGroup } from './indirect'
import { readPropertyOperand } from './operand'
import type { PropertyOperation, PropertyReader, PropertyStyleContext } from './types'

const forbiddenInParagraphStyle = new Set([0x2416, 0x2417, 0x6649, 0x244b, 0x6465, 0x2664,
  0x6467, 0xc66f, 0xc645, 0x2443, 0x4600, 0xc601, 0x2602, 0x4610, 0xc615, 0x442c,
  0x6646, 0x244c, 0x245a, 0x465f, 0x2462, 0xc669, 0x646b, 0xc66c, 0xc666])
const forbiddenInCharacterStyle = new Set([0x0800, 0x0801, 0x085a, 0x0882, 0x0802, 0x0855,
  0x0806, 0x080a, 0x0811, 0x0856, 0x6a03, 0xca57, 0xca89, 0x2a83, 0x4867, 0x6a09,
  0x286f, 0x2a0c, 0x2a90, 0x2a86, 0x6815, 0x6816, 0x6817, 0x4804, 0x6805, 0x4863,
  0x6864, 0xc81a, 0x0818, 0x4a30, 0xca31, 0x2a33, 0xca47, 0xca62, 0x2879, 0x6887, 0x4888, 0xca85])

/**
 * Creates one bounded operation reader for all formatting sources in an inspection.
 * @param data - Optional Data stream used by indirect paragraph properties.
 * @param limits - Shared execution and chain-depth ceilings.
 * @param diagnostics - Optional owner for source compatibility decisions.
 * @param recover - Whether conversion permits bounded local structural-property recovery.
 * @returns Source-list reader with a common parse/application budget.
 */
export function createPropertyReader(data: Uint8Array | undefined, limits: DocReadLimits, diagnostics?: DocReadDiagnostic[], recover = false): PropertyReader {
  let remaining = limits.maxPropertyOperations
  let legacyStyleTabs = false
  const cache = new WeakMap<Uint8Array, readonly PropertyOperation[]>()
  const styleCache = new WeakMap<Uint8Array, readonly PropertyOperation[]>()
  const characterStyleCache = new WeakMap<Uint8Array, readonly PropertyOperation[]>()
  const paragraphCharacterCache = new WeakMap<Uint8Array, readonly PropertyOperation[]>()
  const styleVariants = new Set<string>()

  /** @param code - Bounded source compatibility identity. @param message - Specific source ownership decision. */
  function noteStyleVariant(code: DocReadDiagnostic['code'], message: string): void {
    if (styleVariants.has(code)) return
    styleVariants.add(code); diagnostics?.push({ code, message })
  }

  /**
   * Charges work before allocating or applying property operations.
   * @param count - Work units to consume.
   */
  function consume(count: number): void {
    remaining -= count
    requireDoc(remaining >= 0, 'limit-exceeded', 'Formatting operation budget exceeded')
  }

  /**
   * Expands a list in order; an indirect reference replaces the unprocessed tail.
   * @param bytes - Exact source property list.
   * @param active - Data offsets on the current expansion path.
   * @param style - Optional style kind restricting allowed operations.
   * @returns Bounded ordered operations.
   */
  function expand(bytes: Uint8Array, active: ReadonlySet<number>, style: PropertyStyleContext | undefined): readonly PropertyOperation[] {
    const source = new ByteView(bytes, 'invalid-formatting-data')
    const result: PropertyOperation[] = []
    for (let position = 0; position < bytes.length;) {
      consume(1)
      const opcode = source.u16(position)
      requireDoc(style !== 'paragraph' || (opcode >>> 10 & 7) === 1
        && (!forbiddenInParagraphStyle.has(opcode) || opcode === 0xc615 || opcode === 0x2462)
        && !(recover && opcode === 0x6645),
        'invalid-formatting-data', 'Illegal operation in paragraph style')
      const styleText = style === 'character' || style === 'paragraph-character'
      requireDoc(!styleText || (opcode >>> 10 & 7) === 2
        && (!forbiddenInCharacterStyle.has(opcode) || opcode === 0x286f || opcode === 0x2a0c),
        'invalid-formatting-data', 'Illegal operation in character style')
      const operand = readPropertyOperand(source, position + 2, opcode, recover)
      if (!operand) {
        noteStyleVariant('property-tail-omitted', 'An incomplete structural property and its remaining group tail were omitted; preceding complete properties remain.')
        break
      }
      const length = operand.length
      if (recover && opcode === 0xd608 && length === source.u16(position + 2) + 2)
        noteStyleVariant('table-definition-length-compatibility',
          'A final table definition undercounts its complete source TC80 array by one byte; the actual bounded array was interpreted.')
      if (style === 'paragraph' && opcode === 0x2462) {
        requireDoc(operand[0]! <= 1, 'invalid-formatting-data', 'Invalid style frame-overlap flag')
        noteStyleVariant('legacy-style-frame-overlap', 'A paragraph style stores a frame-overlap flag; its raw operation remains unprojected in its original style layer.')
      }
      // The same character UPX can belong to a paragraph or character style.
      // Preserve the former's highlighter; the latter cannot override its
      // underlying paragraph/direct highlight, even with an explicit clear.
      if (styleText && opcode === 0x286f) {
        requireDoc([0, 1, 2, 255].includes(operand[0]!), 'invalid-formatting-data', 'Invalid character script hint')
        noteStyleVariant('legacy-style-script-hint', 'A legacy style stores a script hint; its original value remains in the same character-property layer.')
      }
      if (styleText && opcode === 0x2a0c) {
        requireDoc(operand[0]! <= 16, 'invalid-formatting-data', 'Invalid style highlight color')
        if (style === 'character') {
          noteStyleVariant('character-style-highlight-ignored', 'Character-style highlighting is ignored without clearing underlying paragraph or direct highlighting.')
          position += 2 + length; continue
        }
        noteStyleVariant('legacy-paragraph-style-highlight', 'A legacy paragraph style stores character highlighting; its original value and explicit clear remain in the paragraph style.')
      }
      if (style === 'paragraph' && opcode === 0xc615 && !legacyStyleTabs) {
        diagnostics?.push({ code: 'legacy-style-tab-operation',
          message: 'A legacy paragraph style stores PChgTabs edits; its complete counted tab operand is interpreted.' })
        legacyStyleTabs = true
      }
      if (opcode === 0x646b || (opcode === 0x6646 || recover && opcode === 0x6645) && position === 0) {
        // Indirect lists can refer to each other. Keep the path separate from the
        // cache so a cycle can never masquerade as an already compiled value.
        const offset = new ByteView(operand, 'invalid-formatting-data').u32(0)
        requireDoc(active.size < limits.maxFormattingDepth, 'limit-exceeded', 'Indirect property depth exceeded')
        const group = readIndirectPropertyGroup(offset, data)
        if (recover && (!group || active.has(offset))) {
          noteStyleVariant('indirect-property-omitted', 'An unavailable or cyclic indirect property reference was omitted; complete local properties remain.')
          position += 2 + length; continue
        }
        requireDoc(data, 'invalid-formatting-data', 'Indirect paragraph properties require a Data stream')
        requireDoc(!active.has(offset), 'invalid-formatting-data', 'Cyclic indirect paragraph properties')
        requireDoc(group && (recover || group.length >= 10), 'invalid-formatting-data', 'Invalid indirect property group length')
        if (opcode === 0x6645 || group.length < 10) noteStyleVariant('indirect-property-compatibility',
          'A legacy indirect opcode or short complete PrcData group was interpreted within its actual source bytes.')
        const path = new Set(active); path.add(offset)
        const expanded = expand(group, path, undefined)
        consume(expanded.length)
        for (const operation of expanded) result.push(operation)
        break
      }
      result.push({ opcode, operand })
      position += 2 + length
    }
    return result
  }

  /**
   * Reuses immutable source parsing while leaving repeated application budgeted.
   * @param bytes - Exact source list.
   * @param style - Optional style operation restrictions.
   * @returns Parsed operations.
   */
  function read(bytes: Uint8Array, style?: PropertyStyleContext): readonly PropertyOperation[] {
    const values = style === 'paragraph' ? styleCache : style === 'character' ? characterStyleCache
      : style === 'paragraph-character' ? paragraphCharacterCache : cache
    let result = values.get(bytes)
    if (!result) { result = expand(bytes, new Set(), style); values.set(bytes, result) }
    return result
  }
  return { read, consume }
}
