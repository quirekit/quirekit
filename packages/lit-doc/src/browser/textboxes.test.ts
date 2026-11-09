import { expect, it, vi } from 'vitest'
import { inspectDoc } from '../inspection'
import { compoundFixture } from '../testing/compound'
import { textboxStreams } from '../testing/textboxes/streams'
import { inspectDocInWorker } from './inspection'

it.each(['omitted', 'part', 'role', 'union', 'terminal', 'range', 'dependency', 'flags', 'sparse'])(
  'forwards textbox source inspection and refuses incomplete Worker metadata: %s', async kind => {
    const input = compoundFixture(textboxStreams('A\r\r\r', '', [{ kind: 'textbox', entries: [
      { start: 0, end: 3, reuseFlags: 0, data: [1, 0], destination: 0xffffffff, shapeId: 1026, undoTextId: 0 },
      { start: 3, end: 0x7fffffff, reuseFlags: 0, data: [0xffffffff, 0], destination: 0, shapeId: 0, undoTextId: 0 },
    ], breaks: [{ start: 0, end: 3, textboxIndex: 0, dependency: -2, flags: 0x1800 }] }]))
    const reply = inspectDoc(input, { includeTextboxes: true }), part = reply.textboxes!.parts[0]!
    if (kind === 'omitted') delete reply.textboxes
    else if (kind === 'part') reply.textboxes = { ...reply.textboxes!, parts: [part] }
    else if (kind === 'role') part.entries[1]!.reusable = false
    else if (kind === 'union') part.entries[0]!.data = [1] as unknown as readonly [number, number]
    else if (kind === 'terminal') part.textTerminalCp = 0
    else if (kind === 'range') part.entries[0]!.end = 999
    else if (kind === 'dependency') part.breaks[0]!.dependency = 65535
    else if (kind === 'flags') part.breaks[0]!.flags = -1
    else delete (part.entries as (typeof part.entries[number] | undefined)[])[0]
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const result = inspectDocInWorker(input, { includeTextboxes: true, createWorker: () => worker })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeTextboxes: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: reply } }))
    await rejected; expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
