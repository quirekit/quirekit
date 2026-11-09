import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readDefaultTabInterval } from '../../word/settings/tabs'
import type { WordDocumentSource } from '../../word/document/types'
import type { WordHeader } from '../../word/types'
import { createProjectionContext } from '../xml/context'
import { createDocxSourcePlan } from '../plan'
import { projectDefaultTabInterval } from './tabs'

/** @param value - Signed original value. @param length - DOP span. @returns Offset source with a bounded DOP locator. */
function source(value: number, length = 12): WordDocumentSource {
  const table = new Uint8Array(20)
  new DataView(table.buffer).setInt16(14, value, true)
  const records = Array.from({ length: 32 }, () => ({ offset: 0, length: 0 }))
  records[31] = { offset: 4, length }
  return { table, header: { records } as unknown as WordHeader } as WordDocumentSource
}

/** @param policy - Explicit conversion policy. @returns Fresh projection owner. */
function context(policy: 'strict' | 'best-effort') {
  return createProjectionContext({ lossPolicy: policy }, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 })
}

describe('DOP default tab interval', () => {
  it.each([284, 708, 709, 720, 1304, 32767])('projects literal positive interval %i without normalization', value => {
    const input = source(value), owner = context('best-effort')
    expect(readDefaultTabInterval(input.table, input.header)).toBe(value)
    expect(projectDefaultTabInterval(input, owner)).toMatchObject({ localName: 'defaultTabStop', attributes: [{ value: String(value) }] })
    expect(owner.report.diagnostics).toEqual([])
  })

  it.each([0, -1, -32768])('omits nonpositive signed interval %i only with an explicit loss', value => {
    const input = source(value), owner = context('best-effort')
    expect(readDefaultTabInterval(input.table, input.header)).toBe(value)
    expect(projectDefaultTabInterval(input, owner)).toBeUndefined()
    expect(owner.report.diagnostics).toEqual([expect.objectContaining({ code: 'default-tab-interval-unprojected', kind: 'loss', source: 'document:defaultTabStop' })])
    expect(owner.report.diagnostics[0]!.message).toContain(String(value))
    expect(() => projectDefaultTabInterval(input, context('strict'))).toThrow(/default tab interval/)
  })

  it('keeps absent DOP distinct from a malformed nonempty DOP', () => {
    const absent = source(0, 0), truncated = source(720, 11), owner = context('best-effort')
    expect(readDefaultTabInterval(absent.table, absent.header)).toBeNull()
    expect(projectDefaultTabInterval(absent, owner)).toBeUndefined()
    expect(owner.report.diagnostics).toEqual([])
    expect(() => readDefaultTabInterval(truncated.table, truncated.header)).toThrow()
    expect(projectDefaultTabInterval(truncated, owner)).toBeUndefined()
    expect(owner.report.lossy).toBe(true)
    expect(() => projectDefaultTabInterval(truncated, context('strict'))).toThrow()
  })

  it('connects original Word DOP to exactly one actual settings part', () => {
    const bytes = new Uint8Array(readFileSync(new URL('../../testing/fixtures/word-mac/chinese-basic.doc', import.meta.url)))
    const result = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    const settings = result.plan.parts.filter(part => part.name === '/word/settings.xml')
    expect(settings).toHaveLength(1)
    expect(settings[0]!.root!.children).toContainEqual(expect.objectContaining({ localName: 'defaultTabStop', attributes: [expect.objectContaining({ value: '425' })] }))
    expect(result.plan.relationships.filter(item => item.key === 'settings')).toHaveLength(1)
  })
})
