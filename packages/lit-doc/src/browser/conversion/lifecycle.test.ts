import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocConversionError } from '../../conversion/errors'
import { createProjectionContext } from '../../conversion/xml/context'
import { convertDocToDocxInWorker, parseDocInWorker } from './run'

/** @returns Exclusively owned fake worker with observable host cleanup. */
function fakeWorker() { const worker = new EventTarget() as Worker; worker.terminate = vi.fn(); worker.postMessage = vi.fn(); return worker }
/** @returns Minimal complete source projection report. */
function report() { return createProjectionContext({}, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 }).report }

afterEach(() => vi.useRealTimers())

describe('full conversion worker lifecycle', () => {
  it.each(['abort', 'timeout', 'error', 'messageerror'])('terminates the complete task after %s and removes the deadline', async mode => {
    vi.useFakeTimers()
    const worker = fakeWorker()
    const controller = new AbortController()
    const result = convertDocToDocxInWorker(Uint8Array.of(1), { createWorker: () => worker, signal: controller.signal, timeoutMs: 100 })
    const rejected = expect(result).rejects.toMatchObject({ code: mode === 'abort' ? 'aborted' : mode === 'timeout' ? 'timeout' : 'worker-failed' })
    if (mode === 'abort') controller.abort()
    else if (mode === 'timeout') vi.advanceTimersByTime(100)
    else worker.dispatchEvent(new Event(mode))
    await rejected
    worker.dispatchEvent(new Event('error')); vi.runAllTimers()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('retains the caller buffer and returns the requested complete package/report once', async () => {
    const worker = fakeWorker(); const input = Uint8Array.of(1, 2)
    const result = convertDocToDocxInWorker(input, { createWorker: () => worker, lossPolicy: 'best-effort' })
    const request = vi.mocked(worker.postMessage).mock.calls[0]!
    expect((request[0] as { input: Uint8Array }).input).not.toBe(input)
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', operation: 'convert-docx', result: { docx: Uint8Array.of(80, 75), report: report() } } }))
    expect((await result).docx).toEqual(Uint8Array.of(80, 75))
    expect(input).toEqual(Uint8Array.of(1, 2)); expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('restores a strict semantic-loss error with its complete report', async () => {
    const worker = fakeWorker(); const evidence = report(); evidence.lossy = true; evidence.lossPolicy = 'strict'
    const result = convertDocToDocxInWorker(Uint8Array.of(1), { createWorker: () => worker, lossPolicy: 'strict' })
    const rejected = expect(result).rejects.toBeInstanceOf(DocConversionError)
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'error', code: 'conversion-loss', message: 'Loss', report: evidence } }))
    await rejected; expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('refuses a package result when LitAST was requested', async () => {
    const worker = fakeWorker(); const result = parseDocInWorker(Uint8Array.of(1), { createWorker: () => worker })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', operation: 'convert-docx', result: { docx: Uint8Array.of(1), report: report() } } }))
    await rejected
  })
  it('starts no worker for missing runtime assembly, invalid output limits or an already cancelled task', async () => {
    const createWorker = vi.fn(fakeWorker)
    const controller = new AbortController(); controller.abort()
    await expect(convertDocToDocxInWorker(Uint8Array.of(1))).rejects.toMatchObject({ code: 'invalid-input' })
    await expect(convertDocToDocxInWorker(Uint8Array.of(1), { createWorker, outputLimits: { maxXmlNodes: 0 } })).rejects.toMatchObject({ code: 'invalid-input' })
    await expect(convertDocToDocxInWorker(Uint8Array.of(1), { createWorker, signal: controller.signal })).rejects.toMatchObject({ code: 'aborted' })
    expect(createWorker).not.toHaveBeenCalled()
  })
})
