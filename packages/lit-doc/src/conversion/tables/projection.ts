import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { DocReadError } from '../../errors'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { tablePositionProperties } from './position'
import { compileTableGeometry } from './geometry'
import { cellProperties, rowProperties, tableProperties } from './properties'
import type { CompiledTableGeometry, ProjectTableCellBlocks } from './types'
import { hasTablePropertyRevision } from '../../word/tables/revisions'

const sourceRefusals = new Set(['invalid-table-data', 'unsupported-table', 'invalid-formatting-data', 'unsupported-formatting'])

/**
 * Compiles optional geometry atomically, keeping the already verified basic topology on a diagnosed source refusal.
 * @param source - Complete core source and captured row authorities.
 * @param index - Source table slot.
 * @param blocks - Existing body owner for cell content and nested tables.
 * @param context - XML, loss policy and output budgets.
 * @returns One complete table, retaining all explicit source cells.
 */
export function projectSourceTable(source: ConversionSource, index: number, blocks: ProjectTableCellBlocks, context: ProjectionContext): DocxXmlElementPlan {
  const table = source.tables[index]!, e = context.element
  let geometry: CompiledTableGeometry | null
  try { geometry = compileTableGeometry(table, source) } catch (error) {
    // Core membership has already succeeded. Only known optional source-format
    // refusals can recover; budgets and programming failures always escape.
    if (!(error instanceof DocReadError) || !sourceRefusals.has(error.code) || context.report.lossPolicy !== 'best-effort') throw error
    geometry = null
    context.diagnose({ code: 'table-geometry-unprojected', kind: 'loss', source: 'table', start: table.start, end: table.end,
      message: `Optional table geometry and merge properties are omitted (${error.code}: ${error.message}); verified source rows and cells are retained.` })
  }
  const base = geometry?.rows[0]?.source.table
  const children = [e('tblPr', {}, [...tablePositionProperties(table, context), e('bidiVisual', { val: table.identity.bidi ? '1' : '0' }),
    ...(base ? tableProperties(base, geometry!.origin, context) : [])]),
  e('tblGrid', {}, geometry?.grid.map(value => e('gridCol', { w: value })) ?? [])]

  // XML and retention diagnostics begin only after the complete common grid
  // and adjacent merge graph have passed source validation.
  table.rows.forEach((row, rowIndex) => {
    const operations = source.tableRowOperations.get(row.markerStart)!
    // A geometry fallback must not hide omitted review history. The complete
    // ordered operation stream remains the authority for current properties.
    if (hasTablePropertyRevision(operations)) context.diagnose({ code: 'table-property-revision-unprojected', kind: 'loss', source: 'table', start: row.start, end: row.end,
      message: 'Current table properties are retained; prior property checkpoints and their revision author/date are not yet projected into review history.' })
    const compiled = geometry?.rows[rowIndex]
    const content: DocxXmlElementPlan[] = []
    if (compiled && JSON.stringify(compiled.source.table) !== JSON.stringify(base)) {
      content.push(e('tblPrEx', {}, tableProperties(compiled.source.table, geometry!.origin, context)))
      context.diagnose({ code: 'table-row-exceptions-host-limit', kind: 'host-limit', source: 'table', start: row.start, end: row.end,
        message: 'Row-specific table preferences are retained in OOXML exceptions; complete LitAST/Classic interpretation of these exceptions requires separate field coverage.' })
    }
    if (compiled) {
      const properties = rowProperties(compiled, geometry!, context)
      if (properties.length) content.push(e('trPr', {}, properties))
      if (compiled.source.unsupportedOpcodes.length) context.diagnose({ code: 'table-formatting-unprojected', kind: 'loss', source: 'table', start: row.start, end: row.end,
        message: `Source row operations ${compiled.source.unsupportedOpcodes.map(code => `0x${code.toString(16)}`).join(', ')} require additional table styling or metadata projection.` })
      if (compiled.source.cells.some(cell => cell.unprojectedBorders)) context.diagnose({ code: 'table-cell-borders-unprojected', kind: 'loss', source: 'table', start: row.start, end: row.end,
        message: 'Stored legacy cell border records are not yet projected.' })
      const presentation = [
        compiled.source.cells.some(cell => cell.textDirection !== 'lrTb') ? 'textDirection' : null,
        compiled.source.cells.some(cell => cell.fitText) ? 'fitText' : null,
        compiled.source.cells.some(cell => cell.hideMark) ? 'hideMark' : null,
      ].filter(Boolean)
      if (presentation.length) context.diagnose({ code: 'table-cell-presentation-host-limit', kind: 'host-limit', source: 'table', start: row.start, end: row.end,
        message: `Cell ${presentation.join(', ')} values are retained in OOXML and canonical attrs; the current Classic table layout does not consume them.` })
      if (['start', 'end'].includes(compiled.source.table.alignment)) context.diagnose({ code: 'table-logical-alignment-host-limit', kind: 'host-limit', source: 'table', start: row.start, end: row.end,
        message: 'Logical table alignment is retained in OOXML; the current Classic table alignment consumer covers physical left/center/right.' })
      if (compiled.source.header === true && compiled.header === false) context.diagnose({ code: 'table-noncontiguous-header-ignored', kind: 'compatibility', source: 'table', start: row.start, end: row.end,
        message: 'A repeating-header flag after the contiguous header prefix is ignored under the source rule.' })
      for (const [side, count, preferred] of [['before', compiled.before, compiled.source.before], ['after', compiled.after, compiled.source.after]] as const)
        if (preferred && preferred.type !== 'nil' && preferred.value !== 0) {
          context.diagnose({ code: 'table-preferred-offset-host-limit', kind: 'host-limit', source: 'table', start: row.start, end: row.end,
            message: `Preferred ${side} width is retained in OOXML; the current Classic row consumer retains the omitted grid count without using this separate width preference.` })
          if (count === 0) context.diagnose({ code: 'table-preferred-offset-approximated', kind: 'approximation', source: 'table', start: row.start, end: row.end,
            message: `Preferred ${side} width has no omitted physical grid columns; its source preference is retained without inventing columns.` })
        }
    }
    row.cells.forEach((cell, cellIndex) => {
      const properties = compiled ? cellProperties(compiled.source.cells[cellIndex]!, compiled.spans[cellIndex]!, context) : []
      const body = blocks(cell.blocks)
      if (body[body.length - 1]?.localName !== 'p') body.push(e('p'))
      content.push(e('tc', {}, [...(properties.length ? [e('tcPr', {}, properties)] : []), ...body]))
    })
    children.push(e('tr', {}, content))
  })
  return e('tbl', {}, children)
}
