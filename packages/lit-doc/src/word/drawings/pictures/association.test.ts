import { expect, it } from 'vitest'
import type { OfficeArtRecord } from '../../office-art/types'
import { readFloatingPictureAssociation } from './association'

/** @param value - Independent unsigned original index. @param length - Original payload length. @returns A bounded shape child with independently encoded payload bytes. */
function client(value: number, length = 4): OfficeArtRecord {
  const data = new Uint8Array(4); new DataView(data.buffer).setUint32(0, value, true)
  return { type: 0xf010, version: 0, instance: 0, data: data.subarray(0, length), end: 8 + length }
}

it('keeps absent and exact associations distinct from a recovered later zero', () => {
  expect(readFloatingPictureAssociation([], 3, 1)).toBe(false)
  expect(readFloatingPictureAssociation([client(3)], 3, 1)).toBe(false)
  expect(readFloatingPictureAssociation([client(0)], 3, 1)).toBe(true)
})

it.each([
  { records: [client(1)], expected: 0, references: 1 },
  { records: [client(0xffffffff)], expected: 1, references: 1 },
  { records: [client(0)], expected: 1, references: 2 },
  { records: [client(0), client(0)], expected: 1, references: 1 },
  { records: [client(0, 3)], expected: 1, references: 1 },
])('rejects nonzero conflicts, invalid extents and ambiguous ownership: %j', ({ records, expected, references }) => {
  expect(() => readFloatingPictureAssociation(records, expected, references)).toThrow(expect.objectContaining({ code: 'invalid-drawing-data' }))
})
