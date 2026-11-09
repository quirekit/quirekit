import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspectDocInWorker } from './inspection'

afterEach(() => vi.useRealTimers())

describe('browser task failure lifecycle', () => {
  it('forwards field inspection and rejects missing evidence from an older worker', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeFields: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeFields: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage' } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('forwards settings inspection and rejects missing evidence from an older worker', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeNoteSettings: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeNoteSettings: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage' } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('forwards note inspection and refuses missing source-note evidence from an older worker', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeNotes: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeNotes: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage' } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it.each(['message', 'error', 'messageerror'])('terminates and rejects a %s failure once', async (eventType) => {
    vi.useFakeTimers()
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    worker.dispatchEvent(eventType === 'message' ? new MessageEvent('message', { data: { version: 99 } }) : new Event(eventType))
    await rejected
    worker.dispatchEvent(new Event('error'))
    vi.runAllTimers()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up a postMessage failure and detaches no caller buffer', async () => {
    vi.useFakeTimers()
    const input = Uint8Array.of(1, 2)
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn(() => { throw new Error('Cannot clone') })
    await expect(inspectDocInWorker(input, { createWorker: () => worker })).rejects.toMatchObject({ code: 'worker-failed' })
    expect(input).toEqual(Uint8Array.of(1, 2))
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a worker for invalid budgets or an already cancelled request', async () => {
    const createWorker = vi.fn(() => { throw new Error('Unexpected creation') })
    const controller = new AbortController()
    controller.abort()
    await expect(inspectDocInWorker(Uint8Array.of(1), { createWorker, signal: controller.signal })).rejects.toMatchObject({ code: 'aborted' })
    await expect(inspectDocInWorker(Uint8Array.of(1), { createWorker, timeoutMs: 0 })).rejects.toMatchObject({ code: 'invalid-input' })
    expect(createWorker).not.toHaveBeenCalled()
  })

  it('forwards paragraph inspection and rejects an older worker that omits the requested result', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeParagraphs: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ includeParagraphs: true }),
    }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage' } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it.each([[], [null], [{ start: 0, end: 2, ending: 'paragraph' }]].map(paragraphs => ({ paragraphs })))('requires each requested base format from the worker: %j', async ({ paragraphs }) => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeParagraphFormatting: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ includeParagraphFormatting: true }),
    }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result',
      result: { scope: 'text-storage', paragraphs } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('forwards character inspection and refuses an older worker that only returns paragraph settings', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeCharacterFormatting: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeCharacterFormatting: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: {
      scope: 'text-storage', paragraphs: [{ start: 0, end: 2, ending: 'paragraph', baseFormat: { scope: 'paragraph-base' } }],
    } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('forwards topology inspection and rejects omitted table evidence', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeTables: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeTables: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage', paragraphs: [] } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('forwards numbering inspection and refuses an older worker that omits its source records', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeNumbering: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeNumbering: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage',
      paragraphs: [{ baseFormat: { scope: 'paragraph-base' }, numbering: { rawIndex: 0 } }] } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it.each([undefined, { scope: 'header-footer-source', stories: [], separators: [] },
    { scope: 'wrong', stories: [], separators: [], positions: [] }])('forwards header requests and rejects incomplete source records', async (headerFooters) => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn()
    worker.postMessage = vi.fn()
    const result = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeHeaderFooters: true })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ includeHeaderFooters: true }),
    }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result',
      result: { scope: 'text-storage', headerFooters } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('forwards bookmark inspection and refuses a worker that omits the index', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeBookmarks: true })
    const rejected = expect(task).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeBookmarks: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage' } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('forwards comment inspection and rejects incomplete source graphs from an older worker', async () => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeComments: true })
    const rejected = expect(task).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeComments: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: { scope: 'text-storage', comments: { scope: 'comment-source', entries: [] } } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it.each([
    { scope: 'revision-author-source', authors: [] },
    { scope: 'revision-author-source', present: false, authors: ['Unexpected'] },
    { scope: 'revision-author-source', present: true, authors: [7] },
  ])('forwards revision-author requests and refuses inconsistent presence or names %#', async revisionAuthors => {
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeRevisionAuthors: true })
    const rejected = expect(task).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeRevisionAuthors: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: {
      scope: 'text-storage', revisionAuthors,
    } } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
