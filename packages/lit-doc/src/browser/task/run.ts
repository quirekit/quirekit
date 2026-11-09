import { DocReadError } from '../../errors'
import type { WorkerTaskPolicy } from './types'

/**
 * Runs exactly one task and releases computation, listeners and deadline together.
 * @param request - Serializable task envelope with a privately owned input snapshot.
 * @param transfers - Task-owned buffers to transfer; never caller storage.
 * @param policy - Validated deadline, cancellation and dedicated-worker factory.
 * @param readReply - Protocol-specific validation which may throw a restored task failure.
 * @returns Validated task result after complete host-side cleanup.
 */
export function runOwnedWorkerTask<Result>(request: unknown, transfers: Transferable[], policy: WorkerTaskPolicy,
  readReply: (reply: unknown) => Result): Promise<Result> {
  return new Promise((resolve, reject) => {
    let worker: Worker | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    /** @returns Whether this is the first completion path. */
    function cleanup(): boolean {
      if (settled) return false
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      policy.signal?.removeEventListener('abort', abort)
      worker?.removeEventListener('message', receive)
      worker?.removeEventListener('error', failed)
      worker?.removeEventListener('messageerror', failed)
      worker?.terminate()
      return true
    }
    /** @param error - Restored task or transport failure. */
    function fail(error: unknown): void { if (cleanup()) reject(error) }
    /** Terminates the actual computation on cancellation. */
    function abort(): void { fail(new DocReadError('aborted', 'DOC worker task was cancelled')) }
    /** Handles worker startup, runtime and structured-clone failures. */
    function failed(): void { fail(new DocReadError('worker-failed', 'DOC worker task failed')) }
    /** @param event - Single completion reply from this task's dedicated worker. */
    function receive(event: MessageEvent): void {
      try { const result = readReply(event.data); if (cleanup()) resolve(result) }
      catch (error) { fail(error) }
    }
    // Worker termination is the cancellation authority while the synchronous
    // parser and the host-provided OOXML runtime own the worker's event loop.
    try {
      worker = policy.createWorker()
      worker.addEventListener('message', receive)
      worker.addEventListener('error', failed)
      worker.addEventListener('messageerror', failed)
      policy.signal?.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => fail(new DocReadError('timeout', 'DOC worker task exceeded its time limit')), policy.timeoutMs)
      if (policy.signal?.aborted) { abort(); return }
      worker.postMessage(request, transfers)
    } catch { failed() }
  })
}
