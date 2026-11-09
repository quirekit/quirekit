import { requireDoc } from '../../../errors'
import type { DocReadDiagnostic } from '../../../types'
import type { PropertyOperation } from '../../properties/types'
import type { DocTable } from '../types'
import { paragraphFrameOpcodes } from './read'
import type { TableRowFrameEvidence } from './types'

/**
 * Compares complete final source scalars without guessing absent defaults or parsing another frame model.
 * @param operations - Original ordered paragraph operations at one source ending.
 * @returns Stable final frame signature, or no frame metadata at this ending.
 */
export function readParagraphFrameSignature(operations: readonly PropertyOperation[]): string | undefined {
  const values = new Map<number, readonly number[]>()
  for (const { opcode, operand } of operations) if (paragraphFrameOpcodes.has(opcode)) values.set(opcode, Array.from(operand))
  return values.size ? JSON.stringify([...values].sort(([left], [right]) => left - right)) : undefined
}

/**
 * Resolves duplicate nested frame metadata only after real outer-cell owners and row positions exist.
 * @param tables - Completed, sorted source tables with validated parent links.
 * @param frames - Distinct paragraph-frame signatures indexed by their owning row marker.
 * @returns Explicit source compatibility decisions; unproved frame ownership retains the original refusal.
 */
export function validateNestedFrameOwners(tables: readonly DocTable[], frames: ReadonlyMap<number, TableRowFrameEvidence>): readonly DocReadDiagnostic[] {
  const diagnostics: DocReadDiagnostic[] = []
  for (const table of tables) {
    if (table.identity.position || !table.rows.some(row => frames.has(row.markerStart))) continue
    const signature = frames.get(table.rows[0]!.markerStart)?.first
    const uniform = signature !== undefined && table.rows.every(row => {
      const values = frames.get(row.markerStart)
      return values !== undefined && values.first === signature && values.signatures.size === 1 && values.signatures.has(signature)
    })
    const owner = enclosingPositionFrames(table, tables, frames)
    requireDoc(uniform && owner !== undefined && signature !== undefined && owner.first === signature
      && owner.signatures.size === 1 && owner.signatures.has(signature),
      'unsupported-table', 'Paragraph-frame table positioning requires a dedicated projection')
    diagnostics.push({ code: 'redundant-nested-table-frame',
      message: `Nested table at CP ${table.start} repeats its enclosing positioned row's complete paragraph-frame tuple; the outer table owns placement and no independent inner frame is created.` })
  }
  return diagnostics
}

/**
 * Uses the actual enclosing row, never a frame copied from a sibling row or another table.
 * @param table - Unpositioned nested table carrying repeated frame metadata.
 * @param tables - Completed stable table indexes.
 * @param frames - Per-row source signatures.
 * @returns Nearest positioned ancestor's enclosing-row signatures, or no proved owner.
 */
function enclosingPositionFrames(table: DocTable, tables: readonly DocTable[], frames: ReadonlyMap<number, TableRowFrameEvidence>): TableRowFrameEvidence | undefined {
  let current = table
  while (current.parent) {
    const parent = current.parent, ancestor = tables[parent.tableIndex]
    requireDoc(ancestor && ancestor.level < current.level, 'invalid-table-data', 'Invalid nested table frame ancestry')
    const row = ancestor.rows[parent.rowIndex]
    requireDoc(row, 'invalid-table-data', 'Missing enclosing table frame row')
    if (ancestor.identity.position) return frames.get(row.markerStart)
    current = ancestor
  }
  return undefined
}
