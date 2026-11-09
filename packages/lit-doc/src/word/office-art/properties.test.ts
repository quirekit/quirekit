import { expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { artRecord, pictureBytes, pictureProperties, pictureString } from '../../testing/pictures/records'
import { createPropertyReader } from '../properties/reader'
import { readOfficeArtRecord } from './records'
import { readOfficeArtProperties } from './properties'
import type { OfficeArtReadContext } from './types'

/** @param remaining - Independent aggregate allocation cap. @returns Isolated source work and complex-byte budget. */
function context(remaining = 1024): OfficeArtReadContext {
  const limits = resolveLimits({})
  return { limits, reader: createPropertyReader(undefined, limits), errorCode: 'invalid-drawing-data', propertyBytes: { remaining } }
}

it('keeps raw flags and complex source text including its terminal code unit', () => {
  const owner = context(), bytes = pictureProperties([[0x00c0, pictureString('DRAFT CONTRACT')], [0x4104, 2]])
  expect(readOfficeArtProperties(readOfficeArtRecord(bytes, 0, owner), owner)).toEqual([
    { id: 0xc0, flags: 0x80c0, value: 30, complex: pictureString('DRAFT CONTRACT') },
    { id: 0x104, flags: 0x4104, value: 2 },
  ])
  expect(owner.propertyBytes.remaining).toBe(994)
})

it.each([true, false])('bounds array data with includesHeader=%s and signed compact element widths', includesHeader => {
  const array = new Uint8Array([2, 0, 2, 0, 0xf0, 0xff, 1, 2, 3, 4, 5, 6, 7, 8])
  const fixed = new Uint8Array(12), view = new DataView(fixed.buffer)
  view.setUint16(0, 0x8145, true); view.setUint32(2, includesHeader ? 14 : 8, true)
  view.setUint16(6, 0x80c0, true); view.setUint32(8, 2, true)
  const owner = context(), bytes = artRecord(0xf00b, 2, 3, pictureBytes(fixed, array, new Uint8Array(2)))
  expect(readOfficeArtProperties(readOfficeArtRecord(bytes, 0, owner), owner)).toEqual([
    { id: 0x145, flags: 0x8145, value: includesHeader ? 14 : 8, complex: array },
    { id: 0xc0, flags: 0x80c0, value: 2, complex: new Uint8Array(2) },
  ])
})

it('charges the aggregate complex byte cap before copying and rejects unclaimed trailing bytes', () => {
  const bytes = pictureProperties([[0xc0, pictureString('X')]])
  const owner = context(3)
  expect(() => readOfficeArtProperties(readOfficeArtRecord(bytes, 0, owner), owner)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  const extra = new Uint8Array(bytes.length + 1); extra.set(bytes)
  new DataView(extra.buffer).setUint32(4, bytes.length - 7, true)
  const another = context()
  expect(() => readOfficeArtProperties(readOfficeArtRecord(extra, 0, another), another)).toThrow(expect.objectContaining({ code: 'invalid-drawing-data' }))
})
