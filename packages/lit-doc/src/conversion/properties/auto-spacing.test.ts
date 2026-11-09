import { describe, expect, it } from 'vitest'
import { paragraphProperties } from './paragraphs'
import { defaultParagraphFormat } from '../../word/paragraphs/formatting/defaults'
import { createProjectionContext } from '../xml/context'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'

/** @returns A fresh bounded projection owner. */
function context() { return createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }) }

describe('DOC automatic text spacing OOXML', () => {
  it.each([[false, false], [true, true], [false, true], [true, false]])('projects independent %s/%s with explicit zero', (autoSpaceLatin, autoSpaceNumber) => {
    const nodes = paragraphProperties({ ...defaultParagraphFormat(0), autoSpaceLatin, autoSpaceNumber },
      new Set<ParagraphPropertyKey>(['autoSpaceLatin', 'autoSpaceNumber']), context(), 'paragraph:0')
    expect(nodes.map(node => [node.localName, node.attributes[0]!.value])).toEqual([
      ['autoSpaceDE', autoSpaceLatin ? '1' : '0'], ['autoSpaceDN', autoSpaceNumber ? '1' : '0']
    ])
  })
  it('does not materialize inherited values in an empty local layer', () => {
    expect(paragraphProperties(defaultParagraphFormat(0), new Set(), context(), 'style:15')).toEqual([])
  })
  it('uses the existing schema order between custom tabs and direction', () => {
    const nodes = paragraphProperties(defaultParagraphFormat(0), new Set<ParagraphPropertyKey>(['autoSpaceLatin', 'autoSpaceNumber', 'bidi']), context(), 'paragraph:0')
    expect(nodes.map(node => node.localName)).toEqual(['autoSpaceDE', 'autoSpaceDN', 'bidi'])
  })
})
