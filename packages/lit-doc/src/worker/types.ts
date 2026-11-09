import type { DocInspection, DocReadErrorCode, DocReadOptions } from '../types'

/** One message to an exclusively owned inspection Worker. */
export interface DocWorkerRequest {
  /** Protocol revision. */
  version: 1
  /** Requested source-level operation. */
  type: 'inspect-doc'
  /** Private byte snapshot transferred by the caller adapter. */
  input: Uint8Array
  /** Serializable reader options; no callbacks or AbortSignal crosses the boundary. */
  options: DocReadOptions
}

/** Successful inspection reply. */
export interface DocWorkerResult {
  /** Protocol revision. */
  version: 1
  /** Successful result discriminator. */
  type: 'result'
  /** Source-level inspection, not LitAST. */
  result: DocInspection
}

/** Serializable failure without retaining document bytes. */
export interface DocWorkerFailure {
  /** Protocol revision. */
  version: 1
  /** Failure discriminator. */
  type: 'error'
  /** Stable reader or task error code. */
  code: DocReadErrorCode
  /** Explanation of the failed condition. */
  message: string
}

/** Exactly one completion message per task. */
export type DocWorkerResponse = DocWorkerResult | DocWorkerFailure

/** Minimal worker scope, without importing Node or main-thread DOM APIs. */
export interface DocWorkerScope {
  /** Inbound task handler owned by this adapter. */
  onmessage: ((event: MessageEvent<DocWorkerRequest>) => void) | null
  /**
   * Sends the task outcome to its owning host.
   * @param reply - Serializable task result.
   */
  postMessage(reply: DocWorkerResponse): void
}
