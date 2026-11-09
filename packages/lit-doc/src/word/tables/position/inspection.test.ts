import { expect, it } from 'vitest'
import { inspectDoc } from '../../../inspection'
import { tableDocument } from '../../../testing/tables/document'
import { operation } from '../../../testing/formatting'

/** @param code - Word property opcode. @param value - Exact stored signed/unsigned word. @returns Independent operand bytes. */
function word(code: number, value: number): number[] { return operation(code, value & 255, value >>> 8 & 255) }

/** @param properties - Ordered positioning fields. @returns Source table position from the public reader. */
function position(properties: readonly number[]) {
  const bytes = tableDocument([{ texts: ['A'], edges: [0, 1440], properties }])
  return inspectDoc(bytes, { includeTables: true }).tables![0]!.identity.position
}

it('decodes independent anchors, plus-one offsets, clearances and overlap without changing physical direction', () => {
  expect(position([...operation(0x360d, 0x90), ...word(0x940e, 1441), ...word(0x940f, 721),
    ...word(0x9410, 100), ...word(0x941e, 200), ...word(0x9411, 300), ...word(0x941f, 400), ...operation(0x3465, 1)]))
    .toEqual({ horizontalAnchor: 'page', verticalAnchor: 'page', horizontal: { offset: 1440 }, vertical: { offset: 720 },
      leftFromText: 100, rightFromText: 200, topFromText: 300, bottomFromText: 400, allowOverlap: false })
})

it.each([[0, 'left'], [-4, 'center'], [-8, 'right'], [-12, 'inside'], [-16, 'outside']] as const)
('preserves horizontal special value %i as %s', (encoded, alignment) => {
  expect(position([...operation(0x360d, 0x20), ...word(0x940e, encoded)])!.horizontal).toEqual({ alignment })
})

it.each([[0, 'inline'], [-4, 'top'], [-8, 'center'], [-12, 'bottom'], [-16, 'inside'], [-20, 'outside']] as const)
('preserves vertical special value %i as %s', (encoded, alignment) => {
  expect(position([...operation(0x360d, 0x20), ...word(0x940f, encoded)])!.vertical).toEqual({ alignment })
})

it('uses normative implicit anchors and applies ordered writes including explicit zero', () => {
  expect(position([...word(0x940e, -19), ...word(0x940f, 1), ...word(0x9410, 10), ...word(0x9410, 0),
    ...operation(0x3465, 1), ...operation(0x3465, 0)]))
    .toEqual({ horizontalAnchor: 'column', verticalAnchor: 'margin', horizontal: { offset: -20 }, vertical: { offset: 0 },
      leftFromText: 0, rightFromText: 0, topFromText: 0, bottomFromText: 0, allowOverlap: true })
  expect(position([])).toBeUndefined()
  expect(position([...word(0x940e, 0), ...word(0x940f, 0), ...operation(0x3465, 0)])).toBeUndefined()
  expect(position(operation(0x360d, 0xf0))).toBeUndefined()
})

it.each([operation(0x360d, 0x30), [...operation(0x360d, 0xf0), ...word(0x940f, 1)],
  word(0x940e, 31682), word(0x940f, -31680), word(0x9410, 31681), operation(0x3465, 2), operation(0x3465, 1)].map(properties => ({ properties })))
('refuses invalid and unadmitted complete source tuples', ({ properties }) => {
  expect(() => position(properties)).toThrow(expect.objectContaining({ code: expect.stringMatching(/invalid-table-data|unsupported-table/u) }))
})

it('splits adjacent rows by canonical position and treats equivalent explicit defaults as the same table', () => {
  const common = [...operation(0x360d, 0x20), ...word(0x940f, 1)]
  const bytes = tableDocument([
    { texts: ['A'], edges: [0, 1440], properties: common },
    { texts: ['B'], edges: [0, 1440], properties: [...common, ...word(0x9410, 0), ...operation(0x3465, 0)] },
    { texts: ['C'], edges: [0, 1440], properties: [...common, ...word(0x940f, 2)] },
  ])
  expect(inspectDoc(bytes, { includeTables: true }).tables!.map(table => table.rows.length)).toEqual([2, 1])
  expect(() => inspectDoc(bytes, { includeTables: true, limits: { maxTables: 1 } })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
