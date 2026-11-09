import { expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { createPropertyReader } from '../properties/reader'
import { compileOfficeArtProperties } from './effective'
import type { OfficeArtProperty } from './types'

/** @param id - Independent original property identity. @param value - Complete unsigned source operand. @returns One scalar source write. */
function property(id: number, value: number): OfficeArtProperty { return { id, flags: id, value: value >>> 0 } }

it('resolves each boolean use bit across layers without erasing unrelated inherited values', () => {
  const properties = compileOfficeArtProperties([property(959, 0x00200020), property(959, 0x02000000)],
    createPropertyReader(undefined, resolveLimits({})))
  expect(properties.flag(959, 5, false)).toBe(true)
  expect(properties.flag(959, 9, true)).toBe(false)
  expect(properties.flag(959, 15, true)).toBe(true)
  expect(properties.unprojected()).toEqual([])
})

it('keeps explicit zero scalar writes and reports uninterpreted active boolean bits', () => {
  const properties = compileOfficeArtProperties([property(912, 2), property(912, 0), property(959, 0x00280020), property(999, 1)],
    createPropertyReader(undefined, resolveLimits({})))
  expect(properties.scalar(912, 4)).toBe(0)
  expect(properties.flag(959, 5, false)).toBe(true)
  expect(properties.unprojected()).toEqual([959, 999])
})

it('charges effective interpretation to the shared work budget instead of resetting it per shape', () => {
  const properties = compileOfficeArtProperties([property(959, 0x00200020)],
    createPropertyReader(undefined, resolveLimits({ limits: { maxPropertyOperations: 2 } })))
  expect(properties.flag(959, 5, false)).toBe(true)
  expect(() => properties.flag(959, 9, false)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
