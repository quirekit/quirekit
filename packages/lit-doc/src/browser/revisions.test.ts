import { expect, it, vi } from 'vitest'
import { inspectDoc } from '../inspection'
import { inspectDocInWorker } from './inspection'
import { compoundFixture } from '../testing/compound'
import { revisionRunStreams } from '../testing/revisions/runs'
import { operation } from '../testing/formatting'

it.each(['omitted', 'authors', 'truncated-runs', 'effective-flag', 'timestamp', 'coverage'])(
  'forwards revision inspection and rejects incomplete Worker metadata: %s', async kind => {
    const input = compoundFixture(revisionRunStreams(operation(0x0801, 1)))
    const reply = inspectDoc(input, { includeRevisions: true })
    if (kind === 'omitted') delete reply.revisions
    else if (kind === 'authors') reply.revisions!.authors = { scope: 'revision-author-source', present: true, authors: ['Other'] }
    else if (kind === 'truncated-runs') reply.revisions = { ...reply.revisions!, runs: reply.revisions!.runs.slice(1) }
    else if (kind === 'effective-flag') reply.revisions!.runs[0]!.inserted = false
    else if (kind === 'timestamp') reply.revisions!.runs[0]!.insertion.rawTimestamp = 0x100000000
    else reply.revisions!.runs[0]!.start = -1
    const worker = new EventTarget() as Worker
    worker.terminate = vi.fn(); worker.postMessage = vi.fn()
    const result = inspectDocInWorker(input, { includeRevisions: true, createWorker: () => worker })
    const rejected = expect(result).rejects.toMatchObject({ code: 'worker-failed' })
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ includeRevisions: true }) }), expect.any(Array))
    worker.dispatchEvent(new MessageEvent('message', { data: { version: 1, type: 'result', result: reply } }))
    await rejected
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
