import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation } from '../../word/properties/types'
import type { ProjectionContext } from '../xml/types'

/** @param opcode - Original section operation. @returns Whether the operation belongs to the document grid. */
export function isSectionGridOperation(opcode: number): boolean { return [0x5032, 0x9031, 0x7030].includes(opcode) }

/**
 * Projects the final grid tuple while isolating diagnosed malformed inactive parameters.
 * @param operations - Complete ordered section properties, with no inherited section state.
 * @param context - Explicit loss policy and bounded diagnostic owner.
 * @param source - Original section location.
 * @returns Original grid fields, omitting only unusable inactive character spacing in best-effort mode.
 */
export function projectSectionGrid(operations: readonly PropertyOperation[], context: ProjectionContext,
  source: string): Record<string, string | number> {
  const grid: Record<string, string | number> = { type: 'default' }, invalid: number[] = []
  for (const { opcode, operand } of operations) {
    if (!isSectionGridOperation(opcode)) continue
    const value = new ByteView(operand, 'invalid-formatting-data')
    if (opcode === 0x5032) {
      const mode = value.u16(0)
      requireDoc(mode <= 3, 'invalid-formatting-data', 'Invalid document-grid type')
      grid.type = ['default', 'linesAndChars', 'lines', 'snapToChars'][mode]!
    } else if (opcode === 0x9031) {
      const pitch = value.u16(0)
      requireDoc(pitch >= 1 && pitch <= 31680, 'invalid-formatting-data', 'Invalid grid line pitch')
      grid.linePitch = pitch
    } else {
      const raw = value.u32(0), spacing = raw > 0x7fffffff ? raw - 0x100000000 : raw
      if (spacing >= -670925 && spacing <= 6488064) grid.charSpace = spacing
      else { invalid.push(spacing); delete grid.charSpace }
    }
  }
  // Mode can follow its parameters. Resolve it before allowing inactive residue;
  // an enabled tuple must never use a wrapped, clamped or superseded spacing.
  requireDoc(!invalid.length || context.report.lossPolicy === 'best-effort' && grid.type === 'default',
    'invalid-formatting-data', 'Invalid grid character spacing')
  for (const spacing of invalid) context.diagnose({ code: 'inactive-grid-character-spacing-omitted', kind: 'loss', source,
    message: `Out-of-range source character spacing ${spacing} is omitted from the disabled document grid.` })
  requireDoc(grid.type === 'default' || grid.linePitch !== undefined, 'invalid-formatting-data', 'Enabled document grid requires line pitch')
  return grid
}
