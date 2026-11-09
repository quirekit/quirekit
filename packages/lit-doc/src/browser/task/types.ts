/** One exclusively owned browser task's lifetime policy. */
export interface WorkerTaskPolicy {
  /** Cancels actual computation by terminating the worker. */
  signal?: AbortSignal
  /** Validated total task deadline in milliseconds. */
  timeoutMs: number
  /**
   * Creates one exclusively owned worker with no preexisting tasks.
   * @returns Fresh worker terminated at every completion path.
   */
  createWorker(): Worker
}
