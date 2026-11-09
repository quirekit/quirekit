import { describe, expect, it } from 'vitest'
import { createFormattingContext } from '../formatting/context'
import { applyParagraphProperties } from '../paragraphs/formatting/apply'
import { defaultParagraphFormat } from '../paragraphs/formatting/defaults'
import { createParagraphStyles } from '../paragraphs/formatting/styles'
import { createPropertyReader } from '../properties/reader'
import { resolveLimits } from '../../binary/limits'
import { readDocumentSource } from '../document/read'
import { compoundFixture } from '../../testing/compound'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { wordStreams } from '../../testing/word'
import { numberingRecordsFixture } from '../../testing/numbering'
import { readNumberingRecords } from './records'
import { resolveParagraphNumbering } from './references'

/**
 * Supplies one independently identified nine-level list for reference tests.
 * @returns Source identity and level cardinality needed by the reference resolver.
 */
function records() {
  const { table, header } = numberingRecordsFixture({ multi: true })
  return readNumberingRecords(table, header, resolveLimits({}))
}

describe('paragraph numbering source references', () => {
  it.each([[1, false], [0xffff, true]])('normalizes reference %i without an off-by-one', (rawIndex, keepLogicalIndentation) => {
    expect(resolveParagraphNumbering({ rawIndex, rawLevel: 5 }, records()))
      .toEqual({ rawIndex, rawLevel: 5, instanceIndex: 1, level: 5, keepLogicalIndentation })
  })

  it.each([0, 0xf801])('ignores an inactive level for no-list reference %i', rawIndex => {
    expect(resolveParagraphNumbering({ rawIndex, rawLevel: 255 }, records()))
      .toEqual({ rawIndex, rawLevel: 255, instanceIndex: null, level: null, keepLogicalIndentation: false })
  })

  it('preserves the skip-level identity and rejects invalid or missing active references', () => {
    expect(resolveParagraphNumbering({ rawIndex: 1, rawLevel: 12 }, records()).level).toBe(12)
    for (const state of [{ rawIndex: 1, rawLevel: 9 }, { rawIndex: 2, rawLevel: 0 }, { rawIndex: 0x7ff, rawLevel: 0 }]) {
      expect(() => resolveParagraphNumbering(state, records())).toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
    }
  })

  it('captures ordered operations in the existing interpreter while retaining the base-scope exclusions', () => {
    const reader = createPropertyReader(undefined, resolveLimits({}))
    const state = { rawIndex: 0, rawLevel: 0 }
    const format = defaultParagraphFormat(0)
    applyParagraphProperties(format, reader.read(Uint8Array.from([...op(0x460b, 1, 0), ...op(0x260a, 3), ...op(0x460b, 0xff, 0xff)])),
      reader, undefined, state)
    expect(state).toEqual({ rawIndex: 0xffff, rawLevel: 3, referenceChanged: true, levelChanged: true })
    expect(format.unsupportedOpcodes).toEqual([0x260a, 0x460b])
  })

  it('caches parent and child references independently without a second style traversal', () => {
    const streams = withStyleDefinitions(wordStreams([{ units: [65, 13], unicode: false }]), [
      { index: 0, properties: [...op(0x460b, 1, 0), ...op(0x260a, 2)] },
      { index: 15, parent: 0, properties: op(0x460b, 0, 0) },
    ])
    const source = readDocumentSource(compoundFixture(streams), {})
    const context = createFormattingContext(source.table, undefined, source.header, source.limits, false)
    const styles = createParagraphStyles(context, source.limits, true)
    expect(styles.resolveNumbering(15)).toEqual({ rawIndex: 0, rawLevel: 2, referenceChanged: true })
    expect(styles.resolveNumbering(0)).toEqual({ rawIndex: 1, rawLevel: 2, referenceChanged: true, levelChanged: true })
    const before = styles.resolve(15)
    expect(styles.resolve(15)).toBe(before)
  })
})
