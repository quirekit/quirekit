import { describe, expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { createFormattingContext } from '../../word/formatting/context'
import { readDocumentSource } from '../../word/document/read'
import type { ParagraphNumberingState } from '../../word/numbering/types'
import { readParagraphFormats } from '../../word/paragraphs/formatting/read'
import { createParagraphStyles } from '../../word/paragraphs/formatting/styles'
import { readParagraphRecords } from '../../word/paragraphs/read'

describe('source numbering layer provenance', () => {
  it('keeps ancestor, child and paragraph writes separate even when their final values are equal', () => {
    const direct = op(0x460b, 1, 0)
    const streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
      cuts: [2048, 2050], records: [{ style: 15, bytes: direct }],
    }]), [
      { index: 0, properties: [...op(0x460b, 1, 0), ...op(0x260a, 2)] },
      { index: 15, parent: 0, properties: op(0x260a, 2) },
    ])
    const source = readDocumentSource(compoundFixture(streams), {})
    const context = createFormattingContext(source.table, undefined, source.header, source.limits, false)
    const styles = createParagraphStyles(context, source.limits, true)
    const paragraphs = readParagraphRecords(source.word, source.table, source.header, source.storage, source.limits)
    const states: ParagraphNumberingState[] = []
    readParagraphFormats(source.storage, paragraphs, context, source.limits, undefined, states, styles)
    expect(styles.resolveNumbering(0)).toEqual({ rawIndex: 1, rawLevel: 2, referenceChanged: true, levelChanged: true })
    expect(styles.resolveNumbering(15)).toEqual({ rawIndex: 1, rawLevel: 2, levelChanged: true })
    expect(states).toEqual([{ rawIndex: 1, rawLevel: 2, referenceChanged: true }])
    expect(styles.resolveNumbering(15)).toEqual({ rawIndex: 1, rawLevel: 2, levelChanged: true })
  })
})
