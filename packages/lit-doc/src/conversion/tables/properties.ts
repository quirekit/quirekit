import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { SourceCellFormat, SourceRowTableFormat, SourceTableWidth } from '../../word/tables/formatting'
import type { ProjectionContext } from '../xml/types'
import type { CompiledTableGeometry, CompiledTableRow } from './types'

/** @param name - Word property name. @param value - Exact source preferred dimension. @param context - XML budget. @returns Width element. */
function width(name: string, value: SourceTableWidth, context: ProjectionContext): DocxXmlElementPlan {
  return context.element(name, { w: value.value, type: value.type })
}

/**
 * Builds table or row-exception properties in schema order.
 * @param format - Row-owned preferred settings.
 * @param origin - Common logical-page origin, used only without a preferred indent.
 * @param context - XML budget.
 * @returns Table property children, excluding the separately owned direction flag.
 */
export function tableProperties(format: SourceRowTableFormat, origin: number, context: ProjectionContext): DocxXmlElementPlan[] {
  const children: DocxXmlElementPlan[] = []
  if (format.width) children.push(width('tblW', format.width, context))
  children.push(context.element('jc', { val: format.alignment }))
  const indent = format.indent && format.indent.type !== 'nil' ? format.indent : { type: 'dxa' as const, value: origin }
  children.push(width('tblInd', indent, context), context.element('tblLayout', { type: format.layout }))
  return children
}

/**
 * Preserves physical grid gaps independently of their preferred source measurements.
 * @param row - Common-grid row with contiguous header semantics.
 * @param geometry - Complete common coordinate authority.
 * @param context - XML budget.
 * @returns Ordered trPr children.
 */
export function rowProperties(row: CompiledTableRow, geometry: CompiledTableGeometry, context: ProjectionContext): DocxXmlElementPlan[] {
  const e = context.element, source = row.source
  const children: DocxXmlElementPlan[] = []
  if (row.before) children.push(e('gridBefore', { val: row.before }))
  if (row.after) children.push(e('gridAfter', { val: row.after }))
  if (source.before && source.before.type !== 'nil') children.push(width('wBefore', source.before, context))
  else if (row.before) children.push(width('wBefore', { type: 'dxa', value: source.edges[0]! - geometry.origin }, context))
  if (source.after && source.after.type !== 'nil') children.push(width('wAfter', source.after, context))
  else if (row.after) children.push(width('wAfter', { type: 'dxa', value: geometry.end - source.edges[source.edges.length - 1]! }, context))
  if (source.cantSplit !== null) children.push(e('cantSplit', { val: source.cantSplit ? '1' : '0' }))
  if (source.height) children.push(e('trHeight', { val: source.height.value, hRule: source.height.rule }))
  if (row.header !== null) children.push(e('tblHeader', { val: row.header ? '1' : '0' }))
  return children
}

/**
 * Writes each physical cell's own properties without flattening preferred widths into the grid.
 * @param cell - Canonical direct source cell.
 * @param span - Number of common grid intervals it occupies.
 * @param context - XML budget.
 * @returns Schema-ordered tcPr children.
 */
export function cellProperties(cell: SourceCellFormat, span: number, context: ProjectionContext): DocxXmlElementPlan[] {
  const e = context.element, children: DocxXmlElementPlan[] = []
  if (cell.fields.has('width') && cell.width) children.push(width('tcW', cell.width, context))
  if (span > 1) children.push(e('gridSpan', { val: span }))
  if (cell.horizontal !== 'none') children.push(e('hMerge', { val: cell.horizontal }))
  if (cell.vertical !== 'none') children.push(e('vMerge', { val: cell.vertical }))
  if (cell.fields.has('noWrap')) children.push(e('noWrap', { val: cell.noWrap ? '1' : '0' }))
  if (cell.fields.has('textDirection')) children.push(e('textDirection', { val: cell.textDirection }))
  if (cell.fields.has('fitText')) children.push(e('tcFitText', { val: cell.fitText ? '1' : '0' }))
  if (cell.fields.has('verticalAlign')) children.push(e('vAlign', { val: cell.verticalAlign }))
  if (cell.fields.has('hideMark')) children.push(e('hideMark', { val: cell.hideMark ? '1' : '0' }))
  return children
}
