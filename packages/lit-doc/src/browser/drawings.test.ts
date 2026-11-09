import { expect, it, vi } from 'vitest'
import { inspectDoc } from '../inspection'
import { compoundFixture } from '../testing/compound'
import { drawingAnchors, drawingStreams, labelledDrawing } from '../testing/drawings/streams'
import { artRecord, pictureBytes } from '../testing/pictures/records'
import { inspectDocInWorker } from './inspection'

it.each(['omitted', 'part', 'flags', 'complex', 'position', 'parent', 'source-order'])(
  'forwards drawing inspection and refuses an incomplete Worker source graph: %s', async kind => {
    const input = compoundFixture(drawingStreams(pictureBytes(artRecord(0xf000, 0, 15, new Uint8Array()), labelledDrawing(0)), drawingAnchors()))
    const reply = inspectDoc(input, { includeDrawings: true })
    const part = reply.drawings!.parts[0]!, shape = part.shapes[1]!
    if (kind === 'omitted') delete reply.drawings
    else if (kind === 'part') reply.drawings = { ...reply.drawings!, parts: [part] }
    else if (kind === 'flags') shape.propertyTables[0]!.properties[0]!.flags = 0xc1
    else if (kind === 'complex') delete shape.propertyTables[0]!.properties[0]!.complex
    else if (kind === 'position') part.anchors[0]!.position = 100
    else if (kind === 'parent') shape.parentId = 9999
    else part.sourceOrder = 2
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const result = inspectDocInWorker(input, { includeDrawings: true, createWorker: () => worker })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeDrawings: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: reply } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
