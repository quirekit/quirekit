import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation } from '../../word/properties/types'
import type { ProjectionContext } from '../xml/types'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { NoteSectionProjection } from '../notes/settings/types'
import { isSectionPageBorderOperation, projectSectionPageBorders } from './borders'
import { recognizeLegacySectionOutline } from './legacy-outline'
import { isSectionGridOperation, projectSectionGrid } from './grid'

/**
 * Projects an atomic page tuple without inferring installation-language margins.
 * @param operations - One independent section's ordered source properties.
 * @param context - Bounded XML and located report owner.
 * @param source - Source section authority.
 * @param notes - Successful note rules and explicit suppression at this section.
 * @returns Typed section properties in schema order.
 */
export function sectionProperties(operations: readonly PropertyOperation[], context: ProjectionContext, source: string,
  notes?: NoteSectionProjection): DocxXmlElementPlan {
  const e = context.element
  const page: Record<string, string | number> = { w: 12240, h: 15840, orient: 'portrait' }
  const margins: Record<string, number> = { gutter: 0 }
  const columns: Record<string, number | string> = { num: 1, equalWidth: '1', sep: '0' }
  const grid = projectSectionGrid(operations, context, source)
  const booleans = new Map<string, boolean>()
  let breakType = 'nextPage'
  let vertical = 'top'
  const unsupported: number[] = []
  const borders = projectSectionPageBorders(operations, context, source)
  for (const { opcode, operand } of operations) {
    requireDoc((opcode >>> 10 & 7) === 4, 'invalid-formatting-data', 'Non-section operation in SEPX')
    if (isSectionPageBorderOperation(opcode) || isSectionGridOperation(opcode)
      || recognizeLegacySectionOutline({ opcode, operand }, context, source)) continue
    const value = new ByteView(operand, 'invalid-formatting-data')
    const unsigned = (): number => value.u16(0)
    if (opcode === 0xb01f || opcode === 0xb020) {
      const size = unsigned()
      requireDoc(size >= 144 && size <= 31680, 'invalid-formatting-data', 'Invalid section page size')
      page[opcode === 0xb01f ? 'w' : 'h'] = size
    } else if (opcode === 0x301d) {
      requireDoc(value.u8(0) === 1 || value.u8(0) === 2, 'invalid-formatting-data', 'Invalid section orientation')
      page.orient = value.u8(0) === 1 ? 'portrait' : 'landscape'
    } else if ([0xb021, 0xb022, 0x9023, 0x9024, 0xb017, 0xb018, 0xb025].includes(opcode)) {
      const names = new Map([[0xb021, 'left'], [0xb022, 'right'], [0x9023, 'top'], [0x9024, 'bottom'], [0xb017, 'header'], [0xb018, 'footer'], [0xb025, 'gutter']])
      const raw = unsigned()
      const distance = opcode === 0x9023 || opcode === 0x9024 ? signed16(raw) : raw
      requireDoc(Math.abs(distance) <= (opcode === 0x9023 || opcode === 0x9024 ? 31665 : 31680), 'invalid-formatting-data', 'Invalid section margin')
      margins[names.get(opcode)!] = distance
    } else if (opcode === 0x3009) {
      requireDoc(value.u8(0) <= 4, 'invalid-formatting-data', 'Invalid section break kind')
      breakType = ['continuous', 'nextColumn', 'nextPage', 'evenPage', 'oddPage'][value.u8(0)]!
    } else if (opcode === 0x500b) {
      requireDoc(unsigned() <= 43, 'invalid-formatting-data', 'Invalid section column count')
      columns.num = unsigned() + 1
    } else if (opcode === 0x900c) {
      requireDoc(unsigned() <= 31680, 'invalid-formatting-data', 'Invalid section column spacing')
      columns.space = unsigned()
    } else if ([0x3005, 0x3019, 0x300a, 0x3228, 0x322a].includes(opcode)) {
      requireDoc(value.u8(0) <= 1, 'invalid-formatting-data', 'Invalid section Boolean')
      if (opcode === 0x3005 || opcode === 0x3019) columns[opcode === 0x3005 ? 'equalWidth' : 'sep'] = String(value.u8(0))
      else booleans.set(opcode === 0x300a ? 'titlePg' : opcode === 0x3228 ? 'bidi' : 'rtlGutter', value.u8(0) === 1)
    } else if (opcode === 0x301a) {
      requireDoc(value.u8(0) <= 3, 'invalid-formatting-data', 'Invalid section vertical alignment')
      vertical = ['top', 'center', 'both', 'bottom'][value.u8(0)]!
    } else {
      requireDoc((opcode >>> 13) !== 6, 'unsupported-formatting', 'Compound section properties require a dedicated projection')
      unsupported.push(opcode)
    }
  }
  for (const name of ['left', 'right', 'top', 'bottom']) requireDoc(margins[name] !== undefined, 'invalid-formatting-data', 'Required section margin is absent')
  for (const name of ['header', 'footer']) if (margins[name] === undefined) {
    context.diagnose({ code: 'section-default-approximated', kind: 'approximation', source,
      message: `Source ${name} distance depends on application installation language; best-effort uses the OOXML 720-twip default.` })
    margins[name] = 720
  }
  if (columns.space === undefined) {
    context.diagnose({ code: 'column-spacing-default-approximated', kind: 'approximation', source,
      message: 'Source column spacing depends on installation language; best-effort uses 720 twips.' })
    columns.space = 720
  }
  if (columns.equalWidth === '0') context.diagnose({ code: 'unequal-columns-unprojected', kind: 'loss', source,
    message: 'Unequal column geometry is not projected; best-effort emits equal-width columns with the source count.' })
  if (unsupported.length) context.diagnose({ code: 'section-properties-unprojected', kind: 'loss', source,
    message: `Section operations ${unsupported.map(code => `0x${code.toString(16)}`).join(', ')} are omitted.` })
  return e('sectPr', {}, [...(notes?.elements ?? []), e('type', { val: breakType }), e('pgSz', page), e('pgMar', margins),
    ...(borders === undefined ? [] : [borders]),
    e('cols', { ...columns, ...(columns.equalWidth === '0' ? { equalWidth: '1' } : {}) }), e('vAlign', { val: vertical }),
    ...(notes?.suppressEndnotes === undefined ? [] : [e('noEndnote', { val: notes.suppressEndnotes ? '1' : '0' })]),
    ...[...booleans].map(([name, active]) => e(name, { val: active ? '1' : '0' })), e('docGrid', grid)])
}

/** @param value - Unsigned source word. @returns Signed sixteen-bit value. */
function signed16(value: number): number { return value > 0x7fff ? value - 0x10000 : value }
