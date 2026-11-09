import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { ParagraphSourceRecord } from '../paragraphs/types'
import type { PropertyOperation, PropertyReader } from '../properties/types'
import { readWordStyles } from '../styles/read'
import type { WordStyleRecord, WordStylesSource } from '../styles/types'
import type { WordHeader, WordTextStorage } from '../types'
import { readRowDefinitionCount } from './definitions'
import { readTableIdentity, unresolvedTableOperations, validateTableOperations } from './identity'
import { readParagraphFrameSignature, readTablePosition, validateNestedFrameOwners } from './position'
import type { TableRowFrameEvidence } from './position'
import { readTableRoles } from './roles'
import type { DocTable, DocTableBlock, DocTableCell, TableRowSource, WordTablesSource, TableAllocationBudget } from './types'

/**
 * Constructs source tables with explicit parent-cell membership and stable final indexes.
 * @param table - Selected Table stream.
 * @param header - Validated source locators.
 * @param storage - Original code units and piece changes.
 * @param paragraphs - Complete main-story boundaries.
 * @param reader - Common formatting operation budget.
 * @param limits - Allocation and recursion ceilings.
 * @param rowOperations - Optional conversion-only sink for the original row authority.
 * @param paragraphOffset - Canonical paragraph index of the provided contiguous slice.
 * @param budget - Shared source-table allocations, including failed optional scopes.
 * @returns Tables ordered by depth then source position and source compatibility decisions.
 */
export function readTables(table: Uint8Array, header: WordHeader, storage: WordTextStorage,
  paragraphs: readonly ParagraphSourceRecord[], reader: PropertyReader, limits: DocReadLimits,
  rowOperations?: Map<number, readonly PropertyOperation[]>, paragraphOffset = 0, budget: TableAllocationBudget = { remaining: limits.maxTables }): WordTablesSource {
  const roles = readTableRoles(paragraphs, storage, reader, limits, header.version, paragraphOffset)
  if (roles.some(role => role.level > 0)) {
    requireDoc(!header.records[138]?.length && !header.records[142]?.length,
      'unsupported-table', 'Table boundaries with SDT/protection ranges are not admitted')
    for (const role of roles) if (role.level > 0) validateTableOperations(role.operations)
  }
  const tables: DocTable[] = []
  const frameRows = new Map<number, TableRowFrameEvidence>()
  let cursor = 0
  let sourceStyles: WordStylesSource | undefined
  /** @returns Lazily read styles for resolving explicit table-style identity. */
  function styles(): readonly (WordStyleRecord | undefined)[] { return (sourceStyles ??= readWordStyles(table, header)).styles }

  /**
   * Reads one row without consuming its separate row marker as another cell.
   * @param level - Owning source depth.
   * @returns Complete row and grouping identity.
   */
  function row(level: number): TableRowSource {
    const start = roles[cursor]!.start
    let cellStart = start
    let blocks: DocTableBlock[] = []
    let directParagraphs = 0
    const frameSignatures = new Set<string>()
    let firstFrame: string | undefined
    const cells: DocTableCell[] = []
    while (cursor < roles.length && roles[cursor]!.level >= level) {
      const role = roles[cursor]!
      if (role.level > level) {
        const nested = group(level + 1)
        blocks.push(...nested.map(index => ({ kind: 'table' as const, index })))
        continue
      }
      const frame = readParagraphFrameSignature(role.operations)
      if (role.start === start && role.role !== 'row') firstFrame = frame
      if (frame !== undefined) frameSignatures.add(frame)
      if (role.role === 'row') {
        requireDoc(cells.length > 0 && !blocks.length && cellStart === role.start,
          'invalid-table-data', 'Row marker must immediately follow a complete cell')
        reader.consume(role.operations.length)
        requireDoc(readRowDefinitionCount(role.operations) === cells.length,
          'invalid-table-data', 'Declared table cells disagree with source cell markers')
        const position = readTablePosition(role.operations, reader)
        if (frameSignatures.size) frameRows.set(role.start, { signatures: frameSignatures, first: firstFrame })
        rowOperations?.set(role.start, role.operations)
        cursor++
        return { row: { start, end: role.end, markerStart: role.start, cells,
          unsupportedOpcodes: unresolvedTableOperations(role.operations) }, identity: { ...readTableIdentity(role.operations, styles), ...(position ? { position } : {}) } }
      }
      blocks.push({ kind: 'paragraph', index: role.index }); directParagraphs++
      cursor++
      if (role.role === 'cell') {
        requireDoc(cells.length < 63 && directParagraphs > 0, 'invalid-table-data', 'Invalid source table-cell count or content')
        cells.push({ start: cellStart, end: role.end, blocks })
        cellStart = role.end; blocks = []; directParagraphs = 0
      }
    }
    requireDoc(false, 'invalid-table-data', 'Table row or cell ended without its source terminator')
  }

  /**
   * Groups complete adjacent rows only after their source identity is known.
   * @param level - Required table depth; nested blocks may begin before a direct paragraph.
   * @returns Temporary table indexes for the owning cell or main story.
   */
  function group(level: number): number[] {
    requireDoc(level <= limits.maxTableDepth, 'limit-exceeded', 'Table recursion depth limit exceeded')
    const result: number[] = []
    let current: DocTable | undefined
    let identity = ''
    while (cursor < roles.length && roles[cursor]!.level >= level) {
      const source = row(level)
      const key = JSON.stringify(source.identity)
      if (!current || identity !== key) {
        requireDoc(budget.remaining > 0, 'limit-exceeded', 'Table count limit exceeded')
        budget.remaining--
        current = { start: source.row.start, end: source.row.end, level, identity: source.identity, rows: [] }
        result.push(tables.length); tables.push(current); identity = key
      }
      current.rows.push(source.row); current.end = source.row.end
    }
    return result
  }

  // Complete each hierarchy before assigning public indexes. Nested tables can
  // be discovered before their parent's first row identity is available.
  while (cursor < roles.length) {
    if (roles[cursor]!.level === 0) cursor++
    else group(1)
  }
  const sorted = tables.map((value, index) => ({ value, index })).sort((a, b) => a.value.level - b.value.level || a.value.start - b.value.start)
  const indexes = new Map(sorted.map(({ index }, final) => [index, final]))
  sorted.forEach(({ value }, tableIndex) => value.rows.forEach((source, rowIndex) => source.cells.forEach((cell, cellIndex) => {
    for (const block of cell.blocks) if (block.kind === 'table') {
      const nested = tables[block.index]!
      requireDoc(!nested.parent, 'invalid-table-data', 'Nested table has multiple owning cells')
      nested.parent = { tableIndex, rowIndex, cellIndex }
      block.index = indexes.get(block.index)!
    }
  })))
  const result = sorted.map(({ value }) => value)
  // A nested table can precede its outer TTP. Defer frame ownership until the
  // completed hierarchy supplies that independent row's position authority.
  const frameDiagnostics = validateNestedFrameOwners(result, frameRows)
  return { tables: result, diagnostics: [...(sourceStyles?.diagnostics ?? []), ...frameDiagnostics,
    ...(roles.some(role => role.implicitDepth) ? [{ code: 'implicit-table-depth' as const,
      message: 'Word 97/2000 table membership without any depth operation is interpreted as outer depth one; explicit depths and end markers remain validated.' }] : [])] }
}
