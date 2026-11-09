import { expect, it } from 'vitest'
import { readTableIdentity } from './identity'

it('retains source row grouping when a later style is applied and combines both bidi flags', () => {
  expect(readTableIdentity([
    { opcode: 0x7469, operand: Uint8Array.of(7, 0, 0, 0) },
    { opcode: 0x5664, operand: Uint8Array.of(1, 0) },
    { opcode: 0x563a, operand: Uint8Array.of(11, 0) },
    { opcode: 0x560b, operand: Uint8Array.of(0, 0) },
  ], () => [])).toEqual({ styleIndex: 11, group: 7, bidi: true })
})
