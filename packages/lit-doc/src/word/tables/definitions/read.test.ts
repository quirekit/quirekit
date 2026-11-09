import { describe, expect, it } from 'vitest'
import { readRowDefinitionCount } from './read'

/** @param opcode - Normative code. @param operand - Exact bytes. @returns Source operation. */
function op(opcode: number, ...operand: number[]) { return { opcode, operand: Uint8Array.from(operand) } }

/** @param count - Number of initial cells. @returns Independent monotonically spaced definitions. */
function initial(count: number) {
  return op(0xd608, 4 + count * 2, 0, count, ...Array.from({ length: count + 1 }, (_, i) => [i * 50 & 255, i * 50 >> 8]).flat())
}

describe('source row definition counts', () => {
  it('applies insertion and deletion independently of the table style in exact source order', () => {
    expect(readRowDefinitionCount([initial(2), op(0x7621, 1, 2, 40, 0), op(0x5622, 0, 1)])).toBe(3)
    expect(readRowDefinitionCount([initial(2), op(0x563a, 11, 0), op(0x7621, 0, 1, 40, 0)])).toBe(3)
    expect(readRowDefinitionCount([op(0x7621, 0, 2, 0, 0)])).toBe(2)
    expect(readRowDefinitionCount([initial(2), op(0x5622, 1, 1)])).toBe(2)
  })

  it.each([
    [op(0x7621, 1, 1, 40, 0)],
    [initial(1), op(0x7621, 0, 0, 40, 0)],
    [initial(63), op(0x7621, 0, 1, 40, 0)],
    [initial(1), op(0x5622, 0, 1)],
    [initial(2), op(0x5622, 1, 3)],
    [op(0xd608, 6, 0, 1, 100, 0, 50, 0)],
    [op(0xd608, 7, 0, 1, 0, 0, 50, 0, 1)],
  ])('rejects inconsistent definition operations %j', (...operations) => {
    expect(() => readRowDefinitionCount(operations)).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })
})
