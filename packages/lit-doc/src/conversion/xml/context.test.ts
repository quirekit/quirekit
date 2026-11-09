import { describe, expect, it } from 'vitest'
import { createProjectionContext } from './context'

const counts = { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }

describe('bounded typed XML ownership', () => {
  it('preserves edge whitespace with xml:space and counts its attribute', () => {
    const context = createProjectionContext({}, { ...counts })
    const text = context.element('t', {}, [' 中文 '])
    expect(text.attributes).toEqual([{ namespaceUri: 'http://www.w3.org/XML/1998/namespace', prefix: 'xml', localName: 'space', value: 'preserve' }])
    expect(context.report.output).toEqual({ xmlNodes: 2, xmlCodeUnits: 4 })
  })
  it.each(['\ud800', '\udc00', '\u0000', '\ufffe', '\uffff'])('diagnoses and replaces forbidden XML scalar %j', value => {
    const context = createProjectionContext({ lossPolicy: 'best-effort' }, { ...counts })
    expect(context.element('t', {}, [value]).children).toEqual(['\ufffd'])
    expect(context.report.lossy).toBe(true)
  })
  it('retains a complete non-BMP scalar and aggregates repeated located decisions with counts', () => {
    const context = createProjectionContext({ outputLimits: { maxDiagnostics: 1 } }, { ...counts })
    expect(context.element('t', {}, ['😀']).children).toEqual(['😀'])
    const decision = { code: 'same', kind: 'loss' as const, source: 'character', message: 'Explicit omission' }
    context.diagnose({ ...decision, start: 1, end: 2 }); context.diagnose({ ...decision, start: 3, end: 4 })
    expect(context.report.diagnostics).toEqual([{ ...decision, start: 1, end: 2, occurrences: 2 }])
    expect(() => context.diagnose({ ...decision, code: 'different' })).toThrow(/diagnostic limit/)
  })
})
