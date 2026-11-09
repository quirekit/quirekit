import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation, PropertyReader } from '../properties/types'
import type { PictureReference } from './types'

/** @param operations - Original CHPX followed by piece operations. @param reader - Shared application budget. @returns Final object role and explicit locator preserved across style resets. */
export function readPictureReference(operations: readonly PropertyOperation[], reader: PropertyReader): PictureReference {
  const result: PictureReference = { offset: null, binary: false, object: false, ole: false }
  reader.consume(operations.length)
  for (const operation of operations) {
    if (operation.opcode === 0x6a03) {
      result.offset = new ByteView(operation.operand, 'invalid-picture-data').u32(0)
      requireDoc(result.offset <= 0x7fffffff, 'invalid-picture-data', 'Negative picture source offset')
    }
    const field = operation.opcode === 0x0806 ? 'binary' : operation.opcode === 0x0856 ? 'object' : operation.opcode === 0x080a ? 'ole' : undefined
    if (field) {
      const value = new ByteView(operation.operand, 'invalid-picture-data').u8(0)
      requireDoc(value === 0 || value === 1, 'invalid-picture-data', 'Invalid source object role flag')
      result[field] = value === 1
    }
  }
  return result
}
