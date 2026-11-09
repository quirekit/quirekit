import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation } from '../../word/properties/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Recognizes counted legacy section metadata without inventing modern list definitions or counters.
 * @param operation - Already budgeted section operation with its original length prefix.
 * @param context - Existing bounded report owner.
 * @param source - Original section identity.
 * @returns Whether this is a known, validated legacy outline record with declared projection loss.
 */
export function recognizeLegacySectionOutline(operation: PropertyOperation, context: ProjectionContext, source: string): boolean {
  const { opcode, operand } = operation
  if (opcode !== 0xd202 && opcode !== 0xd238) return false
  const view = new ByteView(operand, 'invalid-formatting-data')
  if (opcode === 0xd202) {
    requireDoc(operand.length === 213 && view.u8(0) === 212,
      'invalid-formatting-data', 'Invalid legacy section outline descriptor length')
    // All nine ANLV80 descriptors address one shared 32-code-unit UTF-16 slot.
    // The extended descriptors with embedded colors have a different layout.
    let characters = 0
    for (let level = 0; level < 9; level++) characters += view.u8(1 + level * 16 + 1) + view.u8(1 + level * 16 + 2)
    requireDoc(characters <= 32, 'invalid-formatting-data', 'Legacy section outline text exceeds its shared storage')
  } else {
    requireDoc(operand.length === 37 && view.u8(0) === 36,
      'invalid-formatting-data', 'Invalid legacy section outline colors length')
    for (let level = 0; level < 9; level++) requireDoc(view.u8(1 + level * 4 + 3) === 0 || view.u8(1 + level * 4 + 3) === 255,
      'invalid-formatting-data', 'Invalid legacy section outline automatic color')
  }
  context.diagnose({ code: 'legacy-section-outline-unprojected', kind: 'loss', source,
    message: opcode === 0xd202
      ? 'Legacy section outline definitions, prefix/suffix text and restart settings are not projected; no legacy numbering sequence is created.'
      : 'Legacy section outline colors are not projected; ordinary text and modern list colors remain independent.' })
  return true
}
