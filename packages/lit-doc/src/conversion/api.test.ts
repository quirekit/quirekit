import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { convertDocToDocx, parseDoc } from './api'
import type { DocxParseRuntime } from './types'

const bytes = new Uint8Array(readFileSync(new URL('../testing/fixtures/word-mac/chinese-basic.doc', import.meta.url)))

describe('host-injected DOC conversion APIs', () => {
  it('rejects strict loss before calling the host writer and never selects another route', async () => {
    const materialize = vi.fn()
    await expect(convertDocToDocx(bytes, { resolveDocxPackageSourcePlan: vi.fn(), materializeNewDocxPackagePlan: materialize }, { lossPolicy: 'strict' })).rejects.toMatchObject({ code: 'conversion-loss' })
    expect(materialize).not.toHaveBeenCalled()
  })
  it('passes one typed graph to the host and parses its exact bytes with existing options', async () => {
    const output = Uint8Array.of(80, 75, 3, 4)
    const ast = { type: 'document', children: [] }
    const runtime: DocxParseRuntime = { resolveDocxPackageSourcePlan: vi.fn(plan => ({ resources: [], relationships: [], parts: plan.parts })),
      materializeNewDocxPackagePlan: vi.fn(async () => output), parseDocx: vi.fn(async () => ({ ast, warnings: [] })) }
    const options = { lossPolicy: 'best-effort' as const, parseOptions: { numberingMode: 'flat-numbered-paragraphs' as const, preserveRawXml: true } }
    const parsed = await parseDoc(bytes, runtime, options)
    expect(parsed.ast).toBe(ast)
    expect(runtime.resolveDocxPackageSourcePlan).toHaveBeenCalledTimes(1)
    expect(runtime.materializeNewDocxPackagePlan).toHaveBeenCalledTimes(1)
    expect(runtime.parseDocx).toHaveBeenCalledWith(output, options.parseOptions)
    expect(parsed.report.route).toBe('doc-ooxml-docx')
  })
  it('propagates host failures rather than retrying with plain text', async () => {
    const failure = new Error('Host writer failure')
    const runtime = { resolveDocxPackageSourcePlan: vi.fn(plan => plan), materializeNewDocxPackagePlan: vi.fn(async () => { throw failure }) }
    await expect(convertDocToDocx(bytes, runtime as never, { lossPolicy: 'best-effort' })).rejects.toBe(failure)
    expect(runtime.materializeNewDocxPackagePlan).toHaveBeenCalledTimes(1)
  })
})
