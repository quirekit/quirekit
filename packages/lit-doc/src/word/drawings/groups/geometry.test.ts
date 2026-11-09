import { expect, it } from 'vitest'
import { mapGroupFrame, sourceGroupFrame } from './geometry'

it('keeps fractional and negative coordinates continuous until final XML', () => {
  const frame = mapGroupFrame([-3, 1, 0, 4], sourceGroupFrame([-2, 0, 5, 7]), { x: 0, y: 0, width: 100, height: 100 })
  expect(frame.x).toBeCloseTo(-100 / 7, 12); expect(frame.y).toBeCloseTo(100 / 7, 12)
  expect(frame.width).toBeCloseTo(300 / 7, 12); expect(frame.height).toBeCloseTo(300 / 7, 12)
  const nested = mapGroupFrame([1, 1, 2, 2], sourceGroupFrame([0, 0, 3, 3]), frame)
  expect(nested.width).toBeCloseTo(100 / 7, 12)
  expect(nested.width).not.toBe(Math.round(frame.width) / 3)
})

it.each([null, [0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 1, 0], [0, 0, Infinity, 1]])('refuses incomplete, reversed, zero or unbounded source axes: %j', bounds => {
  expect(() => sourceGroupFrame(bounds)).toThrow()
})
