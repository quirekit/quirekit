import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { numberingRecordsFixture, withNumberingRecords } from '../../testing/numbering'
import { readDocumentSource } from '../../word/document/read'
import { createDocxSourcePlan } from '../plan'
import { readConversionSource } from '../source/read'
import { createProjectionContext } from '../xml/context'
import { projectNumbering } from './projection'

const native = new Uint8Array(readFileSync(new URL('../../testing/fixtures/word-mac-numbering/numbered-basic.doc', import.meta.url)))

/** @param fixture - Raw list record vector. @returns Actual complete DOC input with relocated list locators. */
function input(fixture: ReturnType<typeof numberingRecordsFixture>): Uint8Array {
  const source = readDocumentSource(native, {})
  const data = source.container.readRootStream('Data')
  return compoundFixture(withNumberingRecords({ WordDocument: source.word, [source.header.tableStream]: source.table,
    ...(data ? { Data: data } : {}) }, fixture))
}

describe('optional numbering graph refusal isolation', () => {
  it.each([{ linkedId: 202 }, { format: 60 }, { template: '%1 literal', placeholder: 0 }])
  ('keeps stored text while omitting the complete refused graph in best-effort mode: %o', options => {
    const { plan, report } = createDocxSourcePlan(input(numberingRecordsFixture(options)), { lossPolicy: 'best-effort' })
    expect(plan.parts.some(part => part.name === '/word/numbering.xml')).toBe(false)
    expect(plan.relationships.some(relationship => relationship.target === '/word/numbering.xml')).toBe(false)
    const document = JSON.stringify(plan.parts.find(part => part.name === '/word/document.xml')!.root)
    expect(document).not.toContain('"localName":"numPr"')
    expect(document).toContain('编号甲 Alpha')
    expect(document).toContain('编号乙 中文')
    expect(document).toContain('编号丙 Gamma')
    expect(report.lossy).toBe(true)
    expect(report.diagnostics.filter(value => value.code === 'numbering-graph-unprojected')).toHaveLength(1)
  })

  it('retains the strict source refusal rather than changing its route', () => {
    expect(() => createDocxSourcePlan(input(numberingRecordsFixture({ linkedId: 202 })), { lossPolicy: 'strict' }))
      .toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
  })

  it('never recovers from source or output budget exhaustion', () => {
    expect(() => createDocxSourcePlan(native, { lossPolicy: 'best-effort', limits: { maxNumberingLevels: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(() => createDocxSourcePlan(native, { lossPolicy: 'best-effort', outputLimits: { maxXmlNodes: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('propagates unexpected interpreter failures instead of recording them as unsupported source data', () => {
    const source = readConversionSource(native, {})
    const failure = new Error('Unexpected interpreter failure')
    source.context.reader = { read() { throw failure }, consume() {} }
    const context = createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 27, paragraphs: 3, characterRuns: 3, tables: 0, styles: 1, fonts: 1, sections: 1 })
    expect(() => projectNumbering(source, context)).toThrow(failure)
  })
})
