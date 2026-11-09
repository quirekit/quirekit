import { expect, it } from 'vitest'
import { createProjectionContext } from '../../conversion/xml/context'
import { readConversionReply } from './reply'

/** @returns Independently assembled complete text-recovery worker result. */
function reply() {
  const context = createProjectionContext({}, { codeUnits: 4, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 })
  context.diagnose({ code: 'document-text-recovered', kind: 'loss', source: 'document', message: 'Unsupported paragraph format.' })
  context.report.recovery = { level: 'text', cause: 'unsupported-formatting',
    unresolvedTextSemantics: ['hidden-formatting', 'tracked-changes'], unmeasuredSourceCounts: ['paragraphs', 'characterRuns', 'sections'] }
  return { version: 1, type: 'result', operation: 'convert-docx', result: { docx: Uint8Array.of(80, 75), report: context.report } }
}

it('accepts complete recovery evidence without requiring a rich source denominator', () => {
  const value = reply()
  expect(readConversionReply(value, 'convert-docx')).toBe(value.result)
})

it.each([
  { level: 'rich' }, { cause: undefined }, { unresolvedTextSemantics: undefined },
  { unresolvedTextSemantics: ['unknown'] }, { unresolvedTextSemantics: ['hidden-formatting', 'hidden-formatting'] },
  { unmeasuredSourceCounts: undefined }, { unmeasuredSourceCounts: ['unknown'] },
  { unmeasuredSourceCounts: ['codeUnits'] }, { unmeasuredSourceCounts: ['sections', 'sections'] },
])('rejects incomplete or contradictory recovery metadata %#', fields => {
  const value = reply()
  Object.assign(value.result.report.recovery!, fields)
  expect(() => readConversionReply(value, 'convert-docx')).toThrow(expect.objectContaining({ code: 'worker-failed' }))
})

it.each(['strict', 'lossless', 'diagnostic', 'counter'])('rejects recovery without consistent %s evidence', conflict => {
  const value = reply(), report = value.result.report
  if (conflict === 'strict') report.lossPolicy = 'strict'
  if (conflict === 'lossless') report.lossy = false
  if (conflict === 'diagnostic') report.diagnostics = []
  if (conflict === 'counter') report.source.paragraphs = 2
  expect(() => readConversionReply(value, 'convert-docx')).toThrow(expect.objectContaining({ code: 'worker-failed' }))
})
