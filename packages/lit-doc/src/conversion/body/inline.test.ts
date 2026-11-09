import { describe, expect, it } from 'vitest'
import { createProjectionContext } from '../xml/context'
import { projectInline } from './inline'

/** @returns Independent inline projection counters and report. */
function context() { return createProjectionContext({}, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }) }

describe('source inline control projection', () => {
  it('keeps tab, line, page and column breaks as distinct typed controls', () => {
    const result = projectInline('a\tb\vc\fd\u000ee', 0, 9, 9, undefined, context())
    expect(result.children.map(child => [child.localName, child.attributes.filter(attribute => attribute.localName === 'type').map(attribute => attribute.value), child.children])).toEqual([
      ['t', [], ['a']], ['tab', [], []], ['t', [], ['b']], ['br', ['textWrapping'], []], ['t', [], ['c']], ['br', ['page'], []], ['t', [], ['d']], ['br', ['column'], []], ['t', [], ['e']],
    ])
  })
  it('retains a complete scalar when a source format cut bisects its surrogate pair', () => {
    const owner = context()
    const result = projectInline('😀x', 0, 1, 3, undefined, owner)
    expect(result.next).toBe(2); expect(result.children[0]!.children).toEqual(['😀'])
    expect(owner.report.diagnostics[0]).toMatchObject({ code: 'surrogate-format-boundary-approximated', start: 0, end: 2 })
  })
  it('maps source nonbreaking/soft hyphens and reports omitted object anchors', () => {
    const owner = context(); const result = projectInline('a\u001eb\u001fc\u0001', 0, 6, 6, undefined, owner)
    expect(result.children.flatMap(child => child.children).join('')).toBe('a\u2011b\u00adc')
    expect(owner.report.diagnostics[0]).toMatchObject({ code: 'object-anchor-unprojected', start: 5, end: 6 })
  })
})
