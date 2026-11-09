import type { DocReadOptions } from '../types'

/** Browser task policy; every call owns and terminates its dedicated Worker. */
export interface DocWorkerOptions extends DocReadOptions {
  /** Cancellation terminates the worker, including an in-progress synchronous parse. */
  signal?: AbortSignal
  /** Total task lifetime including startup; defaults to 20000 ms, maximum 120000 ms. */
  timeoutMs?: number
  /**
   * Creates a fresh dedicated module worker; use this for bundler-managed worker URLs.
   * @returns A worker exclusively owned by this call and terminated when it settles.
   */
  createWorker?: () => Worker
}
