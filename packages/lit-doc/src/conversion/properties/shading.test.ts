import { expect, it } from 'vitest'
import { paragraphProperties } from './paragraphs'
import { defaultParagraphFormat } from '../../word/paragraphs/formatting/defaults'
import { createProjectionContext } from '../xml/context'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'

/** @returns Fresh bounded output authority. */
function context() { return createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }) }

it.each([[0, 'clear'], [1, 'solid'], [8, 'pct50'], [14, 'horzStripe'], [37, 'pct12'], [44, 'pct37'], [58, 'pct87'], [60, 'pct95'], [0xffff, 'nil']])(
  'projects exact Ipat %i as %s and preserves foreground/background separately', (pattern, expected) => {
    const owner = context(), format = { ...defaultParagraphFormat(0), shading: { pattern, foreground: 'auto', background: 'AABBCC' } }
    const nodes = paragraphProperties(format, new Set<ParagraphPropertyKey>(['shading']), owner, 'style:15')
    expect(nodes).toHaveLength(1); expect(nodes[0]!.localName).toBe('shd')
    expect(Object.fromEntries(nodes[0]!.attributes.map(value => [value.localName, value.value])))
      .toEqual({ val: expected, color: 'auto', fill: pattern === 0xffff ? 'auto' : 'AABBCC' })
    expect(owner.report.diagnostics.some(value => value.code === 'paragraph-shading-pattern-host-limit')).toBe(pattern !== 0 && pattern !== 0xffff)
  })

it('keeps inherited source shading out of local properties and omits an absent default', () => {
  const owner = context(), format = { ...defaultParagraphFormat(0), shading: { pattern: 0, foreground: 'auto', background: 'AABBCC' } }
  expect(paragraphProperties(format, new Set(), owner, 'paragraph:0')).toEqual([])
  expect(paragraphProperties(defaultParagraphFormat(0), new Set<ParagraphPropertyKey>(['shading']), owner, 'defaults:paragraph')).toEqual([])
})

it.each([26, 35, 36, 39, 61, 65534])('reports nonportable or reserved pattern %i without guessing another OOXML pattern', pattern => {
  const owner = context(), format = { ...defaultParagraphFormat(0), shading: { pattern, foreground: 'auto', background: 'AABBCC' } }
  expect(paragraphProperties(format, new Set<ParagraphPropertyKey>(['shading']), owner, 'style:15')).toEqual([])
  expect(owner.report.diagnostics).toEqual([expect.objectContaining({ code: 'paragraph-shading-pattern-unprojected', kind: 'loss', source: 'style:15' })])
})

it('places shd before tabs and automatic spacing in standard paragraph property order', () => {
  const format = { ...defaultParagraphFormat(0), shading: { pattern: 0, foreground: 'auto', background: 'AABBCC' } }
  expect(paragraphProperties(format, new Set<ParagraphPropertyKey>(['shading', 'autoSpaceLatin']), context(), 'style:15')
    .map(value => value.localName)).toEqual(['shd', 'autoSpaceDE'])
})
