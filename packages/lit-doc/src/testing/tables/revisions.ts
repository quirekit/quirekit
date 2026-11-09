import { operation as op } from '../formatting'
import { tableDocument } from './document'

/** @param tail - Ordered operations after the current-value edit. @returns Complete normative DOC with old/modified row properties and independent revision metadata. */
export function tableRevisionDocument(tail: readonly number[] = []): Uint8Array {
  return tableDocument([{ texts: ['Alpha', 'Beta'], edges: [0, 1440, 2880], cells: [{ flags: 0, width: 0 }, { flags: 0, width: 0 }],
    properties: [...op(0x3404, 1), ...op(0x9407, 136, 255), ...op(0x3668, 1), ...op(0x9407, 104, 1),
      ...op(0xd667, 7, 1, 0, 0, 0, 0, 0, 0), ...tail] }])
}
