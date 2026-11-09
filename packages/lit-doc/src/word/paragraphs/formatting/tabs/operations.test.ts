import { expect, it } from 'vitest'
import { resolveLimits } from '../../../../binary/limits'
import { operation } from '../../../../testing/formatting'
import { createPropertyReader } from '../../../properties/reader'
import { applyParagraphProperties } from '../apply'
import { copyParagraphFormat, defaultParagraphFormat } from '../defaults'
import { applyTabOperation } from './apply'
import { readTabOperation } from './read'
import type { DocParagraphTabs } from './types'

/**
 * Encodes independent counted edits, leaving order and descriptors under test control.
 * @param additions - Position and raw TBD pairs.
 * @param removals - Position and close-radius pairs.
 * @param long - Whether to exercise the 255 length sentinel.
 * @returns One complete source modifier.
 */
function edit(additions: readonly (readonly [number, number])[], removals: readonly (readonly [number, number])[] = [], long = false) {
  const operand = new Uint8Array(3 + removals.length * 4 + additions.length * 3)
  const view = new DataView(operand.buffer)
  operand[0] = long ? 255 : operand.length - 1
  operand[1] = removals.length
  removals.forEach(([position, radius], index) => {
    view.setInt16(2 + index * 2, position, true)
    view.setInt16(2 + removals.length * 2 + index * 2, radius, true)
  })
  const at = 2 + removals.length * 4
  operand[at] = additions.length
  additions.forEach(([position, descriptor], index) => {
    view.setInt16(at + 1 + index * 2, position, true)
    operand[at + 1 + additions.length * 2 + index] = descriptor
  })
  return { opcode: 0xc615, operand }
}

it('uses a closed minimum deletion interval and retains positions outside both edges', () => {
  const reader = createPropertyReader(undefined, resolveLimits({}))
  const empty: DocParagraphTabs = { stops: [], changes: [], rangeDeletion: false }
  const original = applyTabOperation(empty, edit([694, 695, 720, 745, 746].map(position => [position, 0])), reader)
  const result = applyTabOperation(original, edit([], [[720, 0]]), reader)
  expect(result.stops.map(stop => stop.position)).toEqual([694, 746])
  expect(original.stops).toHaveLength(5)
  expect(empty).toEqual({ stops: [], changes: [], rangeDeletion: false })
})

it('honors larger close ranges, negative locations and additions following deletion', () => {
  const reader = createPropertyReader(undefined, resolveLimits({}))
  const original = applyTabOperation({ stops: [], changes: [], rangeDeletion: false }, edit([[-100, 0], [0, 1], [100, 2]]), reader)
  expect(applyTabOperation(original, edit([[0, 3]], [[0, 100]]), reader).stops)
    .toEqual([{ position: 0, alignment: 3, leader: 0 }])
})

it('keeps the normative list value, ignores bar leaders and reserved descriptor bits', () => {
  expect(readTabOperation(edit([[720, 6], [1440, 0xc0 | 48 | 4], [2160, 56 | 2]])).additions).toEqual([
    { position: 720, alignment: 6, leader: 0 }, { position: 1440, alignment: 4, leader: 0 }, { position: 2160, alignment: 2, leader: 7 },
  ])
})

it('reads a long operand by counts and still applies the following paragraph property', () => {
  const tabs = edit([[720, 0]], [], true)
  const reader = createPropertyReader(undefined, resolveLimits({}))
  const operations = reader.read(Uint8Array.from([...operation(tabs.opcode, ...tabs.operand), ...operation(0x2405, 1)]))
  const format = defaultParagraphFormat(0)
  applyParagraphProperties(format, operations, reader)
  expect(format.tabs.stops).toEqual([{ position: 720, alignment: 0, leader: 0 }])
  expect(format.keepLines).toBe(true)
})

it('starts new provenance at a style or direct layer without sharing mutable inherited stops', () => {
  const parent = defaultParagraphFormat(0)
  parent.tabs = applyTabOperation(parent.tabs, edit([[720, 0]]), createPropertyReader(undefined, resolveLimits({})))
  const child = copyParagraphFormat(parent)
  expect(child.tabs.changes).toEqual([])
  expect(parent.tabs.changes).toHaveLength(1)
  expect(child.tabs.stops[0]).not.toBe(parent.tabs.stops[0])
})

it('rejects effective overflow and consumes bounded repeated work before publishing changes', () => {
  const reader = createPropertyReader(undefined, resolveLimits({}))
  const full = applyTabOperation({ stops: [], changes: [], rangeDeletion: false }, edit(Array.from({ length: 64 }, (_, index) => [index * 100, 0])), reader)
  expect(() => applyTabOperation(full, edit([[6400, 0]]), reader)).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(full.stops).toHaveLength(64)
  expect(() => applyTabOperation(full, edit([]), createPropertyReader(undefined, resolveLimits({ limits: { maxPropertyOperations: 10 } }))))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('rejects excessive counts and out-of-range lengths before decoding arrays', () => {
  const input = edit([[720, 0]])
  input.operand[1] = 65
  expect(() => readTabOperation(input)).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(() => readTabOperation(edit([[31681, 0]]))).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  expect(() => readTabOperation(edit([], [[0, 32767]]))).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})
