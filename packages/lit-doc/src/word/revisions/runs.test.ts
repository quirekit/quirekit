import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { operation as op, withPiecePropertyGroup } from '../../testing/formatting'
import { revisionRunStreams } from '../../testing/revisions/runs'

it('keeps insertion and deletion actors, raw times, unsigned sessions and paragraph-mark identity separate', () => {
  const bytes = compoundFixture(revisionRunStreams([
    ...op(0x0801, 1), ...op(0x0800, 1), ...op(0x4804, 1, 0), ...op(0x4863, 2, 0),
    ...op(0x6805, 0x19, 0x61, 0xc4, 0x47), ...op(0x6864, 0x14, 0x63, 0xc5, 0x47),
    ...op(0x6816, 0xff, 0xff, 0xff, 0xff), ...op(0x6817, 0, 0, 0, 0x80), ...op(0x6815, 1, 0, 0, 0),
    ...op(0x4807, 2, 0), ...op(0x4867, 1, 0),
  ], op(0x0800, 1))), before = bytes.slice()
  const result = inspectDoc(bytes, { includeRevisions: true })
  expect(result.revisions?.scope).toBe('main-story-revision-source')
  expect(result.revisions?.authors).toEqual(result.revisionAuthors)
  expect(result.revisions?.runs).toEqual([
    { start: 0, end: 1, inserted: true, deleted: true,
      insertion: { authorIndex: 1, authorExplicit: true, rawTimestamp: 0x47c46119, reason: 2 },
      deletion: { authorIndex: 2, authorExplicit: true, rawTimestamp: 0x47c56314, reason: 1 },
      insertionSaveId: 0xffffffff, deletionSaveId: 0x80000000, formattingSaveId: 1 },
    { start: 1, end: 2, inserted: false, deleted: true,
      insertion: { authorIndex: 0, authorExplicit: false, rawTimestamp: null, reason: null },
      deletion: { authorIndex: 0, authorExplicit: false, rawTimestamp: null, reason: null },
      insertionSaveId: null, deletionSaveId: null, formattingSaveId: null },
  ])
  expect(result.characterRuns).toHaveLength(2)
  expect(result.paragraphs).toHaveLength(1)
  expect(inspectDoc(bytes, { includeCharacterFormatting: true }).revisions).toBeUndefined()
  expect(bytes).toEqual(before)
})

it.each([0x4a30, 0x2a33])('preserves both review actors across character reset %i and applies the last piece operands', reset => {
  const streams = withPiecePropertyGroup(revisionRunStreams([
    ...op(0x0801, 1), ...op(0x0800, 1), ...op(0x4804, 1, 0), ...op(0x4863, 2, 0),
    ...op(0x6805, 1, 2, 3, 4), ...op(0x6864, 5, 6, 7, 8),
    ...(reset === 0x4a30 ? op(reset, 15, 0) : op(reset, 0)),
  ]), [...op(0x4804, 2, 0), ...op(0x0801, 0), ...op(0x6817, 4, 3, 2, 1)], 0)
  const run = inspectDoc(compoundFixture(streams), { includeRevisions: true }).revisions!.runs[0]!
  expect(run).toMatchObject({ inserted: false, deleted: true, insertionSaveId: null, deletionSaveId: 0x01020304,
    insertion: { authorIndex: 2, authorExplicit: true, rawTimestamp: 0x04030201 },
    deletion: { authorIndex: 2, authorExplicit: true, rawTimestamp: 0x08070605 } })
})

it.each([0, 0x80, 0x81])('uses effective toggle %i instead of treating an opcode as an active revision', value => {
  const bytes = compoundFixture(revisionRunStreams([...op(0x0801, 1), ...op(0x0801, value), ...op(0x4804, 0xff, 0xff)]))
  const run = inspectDoc(bytes, { includeRevisions: true }).revisions!.runs[0]!
  expect(run.inserted).toBe(value === 0x81)
  expect(run.insertion.authorIndex).toBe(-1)
})

it('shares source run and operation-work budgets instead of bypassing formatting limits', () => {
  const bytes = compoundFixture(revisionRunStreams([...op(0x0801, 1), ...op(0x4804, 1, 0)]))
  expect(() => inspectDoc(bytes, { includeRevisions: true, limits: { maxCharacterRuns: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => inspectDoc(bytes, { includeRevisions: 'yes' as unknown as boolean }))
    .toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
