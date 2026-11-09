import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'

/** @param operations - Direct source operations before the independent paragraph ending. @param cleared - Whether the paragraph child explicitly clears highlight. @returns Complete original streams with both kinds of character UPX. */
function document(operations: readonly number[], cleared = false) {
  const source = withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode: false }]), [
    { cuts: [2048, 2051], records: [{ style: 1 }] },
  ]), [{ cuts: [2048, 2050, 2051], records: [operations, undefined] }])
  return compoundFixture(withStyleDefinitions(source, [
    { index: 0, characters: [...op(0x2a0c, 7), ...op(0x286f, 1)] },
    { index: 1, parent: 0, characters: cleared ? op(0x2a0c, 0) : [] },
    { index: 15, kind: 2, parent: 16, characters: [...op(0x2a0c, 0), ...op(0x286f, 2)] },
    { index: 16, kind: 2, characters: op(0x2a0c, 2) },
  ]))
}

it.each([false, true])('keeps character-style highlights out of paragraph inheritance and direct reset, clear=%s', cleared => {
  const result = inspectDoc(document(op(0x4a30, 15, 0), cleared), { includeCharacterFormatting: true })
  expect(result.characterRuns?.map(run => [run.baseFormat.highlight, run.baseFormat.scriptHint]))
    .toEqual([[cleared ? 0 : 7, 1], [cleared ? 0 : 7, 1]])
  expect(result.characterRuns?.[0]?.baseFormat.characterStyleIndex).toBe(15)
})

it.each([0, 1, 2, 255])('keeps direct hint %i and explicit highlighter override over both style owners', hint => {
  const result = inspectDoc(document([...op(0x4a30, 15, 0), ...op(0x286f, hint), ...op(0x2a0c, 4)]), { includeCharacterFormatting: true })
  expect(result.characterRuns?.map(run => [run.baseFormat.highlight, run.baseFormat.scriptHint])).toEqual([[4, hint], [7, 1]])
})
