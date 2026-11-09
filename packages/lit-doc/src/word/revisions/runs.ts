import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocCharacterRun } from '../characters/types'
import type { PropertyOperation, PropertyReader } from '../properties/types'
import type { DocRevisionActorSource, DocRevisionRun } from './types'

/** Scalar review operands interpreted by this source owner and accounted for during projection. */
export const revisionMetadataOpcodes = new Set([0x4804, 0x6805, 0x4807, 0x4863, 0x6864, 0x4867, 0x6815, 0x6816, 0x6817])

/** @returns Independent default source operands, without inventing an actual timestamp. */
function actor(): DocRevisionActorSource { return { authorIndex: 0, authorExplicit: false, rawTimestamp: null, reason: null } }

/**
 * Reads independent review operands from the same ordered layers as effective character flags.
 * @param runs - Complete character ranges and final four-valued toggle results.
 * @param operations - Parallel canonical CHPX then piece operations.
 * @param reader - Shared operation-work authority, charging this additional interpretation pass.
 * @returns Source-ordered review metadata, including paragraph marks and inactive operands.
 */
export function readRevisionRuns(runs: readonly DocCharacterRun[], operations: readonly (readonly PropertyOperation[])[],
  reader: PropertyReader): readonly DocRevisionRun[] {
  requireDoc(runs.length === operations.length, 'invalid-revision-data', 'Revision metadata requires complete character-source layers')
  return runs.map((run, index) => {
    const result: DocRevisionRun = { start: run.start, end: run.end, inserted: run.baseFormat.inserted,
      deleted: run.baseFormat.deleted, insertion: actor(), deletion: actor(), insertionSaveId: null,
      deletionSaveId: null, formattingSaveId: null }
    const layer = operations[index]!
    reader.consume(layer.length)
    // CIstd and CPlain preserve these review properties. The character owner has
    // already applied reset/toggle semantics; only final scalar operands are read here.
    for (const operation of layer) {
      if (!revisionMetadataOpcodes.has(operation.opcode)) continue
      const bytes = new ByteView(operation.operand, 'invalid-revision-data')
      if (operation.opcode === 0x4804 || operation.opcode === 0x4863) {
        const target = operation.opcode === 0x4804 ? result.insertion : result.deletion
        target.authorIndex = bytes.u16(0) << 16 >> 16; target.authorExplicit = true
      } else if (operation.opcode === 0x6805 || operation.opcode === 0x6864) {
        (operation.opcode === 0x6805 ? result.insertion : result.deletion).rawTimestamp = bytes.u32(0)
      } else if (operation.opcode === 0x4807 || operation.opcode === 0x4867) {
        (operation.opcode === 0x4807 ? result.insertion : result.deletion).reason = bytes.u16(0)
      } else if (operation.opcode === 0x6815) result.formattingSaveId = bytes.u32(0)
      else if (operation.opcode === 0x6816) result.insertionSaveId = bytes.u32(0)
      else if (operation.opcode === 0x6817) result.deletionSaveId = bytes.u32(0)
    }
    return result
  })
}
