import { expect, it, vi } from 'vitest'
import { inspectDocInWorker } from './inspection'

it.each([undefined, {}, 'red', { pattern: 0, foreground: 'auto' }, { pattern: 0, foreground: '#ffffff', background: 'auto' },
  { pattern: -1, foreground: 'auto', background: 'auto' }])('refuses incomplete or mistyped shading %j and releases its Worker', async shading => {
  const worker = new EventTarget() as Worker; worker.terminate = vi.fn(); worker.postMessage = vi.fn()
  const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeParagraphFormatting: true })
  const rejected = expect(task).rejects.toMatchObject({ code: 'worker-failed' })
  worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: {
    scope: 'text-storage', paragraphs: [{ baseFormat: { scope: 'paragraph-base', autoSpaceLatin: true, autoSpaceNumber: true, shading } }]
  } } }))
  await rejected; expect(worker.terminate).toHaveBeenCalledTimes(1)
})

it.each([null, { pattern: 0, foreground: 'auto', background: '123456' }, { pattern: 65535, foreground: 'auto', background: 'auto' }])(
  'keeps complete shading %j without rewriting its automatic identity', async shading => {
    const worker = new EventTarget() as Worker; worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeParagraphFormatting: true })
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: {
      scope: 'text-storage', paragraphs: [{ baseFormat: { scope: 'paragraph-base', autoSpaceLatin: true, autoSpaceNumber: true, shading } }]
    } } }))
    expect((await task).paragraphs![0]!.baseFormat!.shading).toEqual(shading); expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
