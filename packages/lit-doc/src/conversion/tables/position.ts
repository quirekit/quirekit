import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocTable } from '../../word/tables/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Preserves table positioning independently of optional grid geometry.
 * @param table - Validated source identity and source range.
 * @param context - Shared XML budget and explicit host limits.
 * @returns Complete positioning and overlap properties in schema order.
 */
export function tablePositionProperties(table: DocTable, context: ProjectionContext): DocxXmlElementPlan[] {
  const position = table.identity.position
  if (!position) return []
  const attributes: Record<string, string | number> = {
    horzAnchor: position.horizontalAnchor === 'column' ? 'text' : position.horizontalAnchor,
    vertAnchor: position.verticalAnchor === 'paragraph' ? 'text' : position.verticalAnchor,
    leftFromText: position.leftFromText, rightFromText: position.rightFromText,
    topFromText: position.topFromText, bottomFromText: position.bottomFromText,
  }
  // Word's native DOC-to-DOCX writer retains the stored integer for numeric
  // table offsets. Source inspection exposes the specified plus-one decoding.
  if ('offset' in position.horizontal) attributes.tblpX = position.horizontal.offset + 1
  else attributes.tblpXSpec = position.horizontal.alignment
  if ('offset' in position.vertical) attributes.tblpY = position.vertical.offset + 1
  else attributes.tblpYSpec = position.vertical.alignment
  if ('offset' in position.horizontal || 'offset' in position.vertical) context.diagnose({
    code: 'table-position-offset-compatibility', kind: 'compatibility', source: 'table', start: table.start, end: table.end,
    message: 'Numeric table offsets retain their stored integer to match native Word DOCX output, one twip above the specified plus-one decoded distance.' })
  if (table.parent || 'alignment' in position.vertical && position.vertical.alignment === 'inline') context.diagnose({
    code: 'table-floating-position-host-limit', kind: 'host-limit', source: 'table', start: table.start, end: table.end,
    message: 'Nested floating tables and the inline vertical sentinel retain their complete OOXML tuple; Classic placement requires separate admission.' })
  return [context.element('tblpPr', attributes), context.element('tblOverlap', { val: position.allowOverlap ? 'overlap' : 'never' })]
}
