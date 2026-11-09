import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { operation as op } from '../../testing/formatting'
import { createPropertyReader } from './reader'
import type { DocReadDiagnostic } from '../../types'

/**
 * Encodes a standalone length-prefixed Data-stream group at an explicit offset.
 * @param bytes - Unmodified operation bytes.
 * @param offset - Stream-relative group position.
 * @returns Independently encoded indirect-property stream.
 */
function dataGroup(bytes: number[], offset = 0): Uint8Array {
  const data = new Uint8Array(offset + 2 + bytes.length)
  new DataView(data.buffer).setUint16(offset, bytes.length, true)
  data.set(bytes, offset + 2)
  return data
}

describe('bounded property operation storage', () => {
  it.each([[0, 1], [1, 1], [2, 2], [3, 4], [4, 2], [5, 2], [7, 3]])('reads fixed size class %i', (kind, length) => {
    const bytes = Uint8Array.from([...op((kind! << 13) | 0x400, ...Array(length).fill(1)), ...op(0x2405, 0)])
    const result = createPropertyReader(undefined, resolveLimits({})).read(bytes)
    expect(result.map(value => value.operand.length)).toEqual([length, 1])
  })

  it('uses the special table length and the extended tab operand counts without losing the next operation', () => {
    const table = op(0xd608, 5, 0, 0, 0, 0, 0)
    const tabs = op(0xc615, 255, 1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0)
    const result = createPropertyReader(undefined, resolveLimits({})).read(Uint8Array.from([...table, ...tabs, ...op(0x2405, 1)]))
    expect(result.map(value => value.opcode)).toEqual([0xd608, 0xc615, 0x2405])
    expect(result.map(value => value.operand.length)).toEqual([6, 13, 1])
  })

  it('replaces an indirect tail and does not parse bytes the format declares ignored', () => {
    const properties = [...op(0x2405, 1), ...op(0x2406, 0), ...op(0x6412, 0xe0, 1, 1, 0)]
    const reader = createPropertyReader(dataGroup(properties), resolveLimits({}))
    const result = reader.read(Uint8Array.from([...op(0x6646, 0, 0, 0, 0), 255]))
    expect(result.map(value => value.opcode)).toEqual([0x2405, 0x2406, 0x6412])
    expect(reader.read(Uint8Array.from([...op(0x2407, 1), ...op(0x646b, 0, 0, 0, 0), 255])))
      .toHaveLength(4)
  })

  it('rejects an indirect cycle, missing stream and truncated source instead of returning partial operations', () => {
    const root = Uint8Array.from(op(0x6646, 0, 0, 0, 0))
    const cyclic = dataGroup([...op(0x646b, 0, 0, 0, 0), ...op(0x6412, 240, 0, 1, 0)])
    expect(() => createPropertyReader(cyclic, resolveLimits({})).read(root))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    expect(() => createPropertyReader(undefined, resolveLimits({})).read(root))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    for (const bytes of [[5], [5, 36], [0x0d, 0xc6, 10, 0], [8, 0xd6, 0, 0], [0x15, 0xc6, 255, 65]]) {
      expect(() => createPropertyReader(undefined, resolveLimits({})).read(Uint8Array.from(bytes)))
        .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    }
  })

  it('charges parsing and repeated application to the same work budget', () => {
    const reader = createPropertyReader(undefined, resolveLimits({ limits: { maxPropertyOperations: 2 } }))
    const bytes = Uint8Array.from(op(0x2405, 1))
    expect(reader.read(bytes)).toBe(reader.read(bytes))
    reader.consume(1)
    expect(() => reader.consume(1)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('does not reuse direct-list validation for a forbidden style operation', () => {
    const reader = createPropertyReader(undefined, resolveLimits({}))
    const bytes = Uint8Array.from(op(0x2416, 1))
    expect(reader.read(bytes)).toHaveLength(1)
    expect(() => reader.read(bytes, 'paragraph')).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it.each([0, 1])('retains legacy style frame-overlap flag %i with one bounded compatibility diagnostic', value => {
    const diagnostics: DocReadDiagnostic[] = []
    const reader = createPropertyReader(undefined, resolveLimits({}), diagnostics)
    const bytes = Uint8Array.from(op(0x2462, value))
    expect(reader.read(bytes, 'paragraph')).toEqual([{ opcode: 0x2462, operand: Uint8Array.of(value) }])
    expect(reader.read(bytes, 'paragraph')).toBe(reader.read(bytes, 'paragraph'))
    reader.read(Uint8Array.from(op(0x2462, 1 - value)), 'paragraph')
    expect(diagnostics.map(item => item.code)).toEqual(['legacy-style-frame-overlap'])
    expect(() => reader.read(bytes, 'character')).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

  it('keeps invalid, truncated, adjacent forbidden operations and exhausted style budgets rejected', () => {
    const reader = createPropertyReader(undefined, resolveLimits({}))
    const direct = Uint8Array.from(op(0x2462, 2))
    expect(reader.read(direct)).toHaveLength(1)
    expect(() => reader.read(direct, 'paragraph')).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    for (const bytes of [[0x62, 0x24], op(0x2462, 255), [...op(0x2462, 1), ...op(0x2416, 1)]])
      expect(() => reader.read(Uint8Array.from(bytes), 'paragraph')).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
    const bounded = createPropertyReader(undefined, resolveLimits({ limits: { maxPropertyOperations: 1 } }))
    expect(() => bounded.read(Uint8Array.from([...op(0x2462, 1), ...op(0x2406, 1)]), 'paragraph'))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('bounds indirect depth independently of cycles and charges expanded copies', () => {
    const leaf = [...op(0x2405, 1), ...op(0x2406, 0), ...op(0x6412, 240, 0, 1, 0)]
    const data = dataGroup(leaf, 40)
    data.set(dataGroup([...op(0x646b, 40, 0, 0, 0), ...op(0x6412, 240, 0, 1, 0)]))
    const root = Uint8Array.from(op(0x6646, 0, 0, 0, 0))
    expect(() => createPropertyReader(data, resolveLimits({ limits: { maxFormattingDepth: 1 } })).read(root))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(() => createPropertyReader(data, resolveLimits({ limits: { maxPropertyOperations: 7 } })).read(root))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(createPropertyReader(data, resolveLimits({})).read(root)).toHaveLength(3)
  })
})
