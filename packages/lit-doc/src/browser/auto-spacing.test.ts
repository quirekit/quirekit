import { expect, it, vi } from 'vitest'
import { inspectDocInWorker } from './inspection'

it.each([
  { autoSpaceLatin: true }, { autoSpaceNumber: false },
  { autoSpaceLatin: 0, autoSpaceNumber: true }, { autoSpaceLatin: false, autoSpaceNumber: '1' }
])('refuses an incomplete or mistyped automatic-spacing reply %j', async fields => {
  const worker = new EventTarget() as Worker
  worker.terminate = vi.fn(); worker.postMessage = vi.fn()
  const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeParagraphFormatting: true })
  const rejected = expect(task).rejects.toMatchObject({ code: 'worker-failed' })
  worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: {
    scope: 'text-storage', paragraphs: [{ baseFormat: { scope: 'paragraph-base', shading: null, ...fields } }]
  } } }))
  await rejected; expect(worker.terminate).toHaveBeenCalledTimes(1)
})

it.each([[false, true], [true, false]])('retains independent %s/%s flags without coercion', async (autoSpaceLatin, autoSpaceNumber) => {
  const worker = new EventTarget() as Worker
  worker.terminate = vi.fn(); worker.postMessage = vi.fn()
  const task = inspectDocInWorker(Uint8Array.of(1), { createWorker: () => worker, includeParagraphFormatting: true })
  const result = { scope: 'text-storage', paragraphs: [{ baseFormat: { scope: 'paragraph-base', autoSpaceLatin, autoSpaceNumber, shading: null } }] }
  worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result } }))
  expect((await task).paragraphs![0]!.baseFormat).toEqual(result.paragraphs[0]!.baseFormat)
  expect(worker.terminate).toHaveBeenCalledTimes(1)
})
