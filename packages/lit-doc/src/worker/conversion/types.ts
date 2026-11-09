import type { DocConversionReport, DocParseOptions, DocParseResult, DocToDocxResult } from '../../conversion/types'
import type { DocReadErrorCode } from '../../types'

/** Exactly one full legacy conversion task per dedicated worker. */
export interface ConversionWorkerRequest {
  /** Separate protocol version from source inspection. */
  version: 1
  /** Requested final product. */
  type: 'convert-docx' | 'parse-doc'
  /** Privately owned input snapshot. */
  input: Uint8Array
  /** Serializable source projection and parser policy. */
  options: DocParseOptions
  /** Explicit host-owned runtime module URL, never derived from the file. */
  runtimeModuleUrl?: string
}

/** Successful conversion or parse reply. */
export interface ConversionWorkerResult {
  /** Protocol revision. */
  version: 1
  /** Successful completion discriminator. */
  type: 'result'
  /** Product family, checked against the request by the host. */
  operation: ConversionWorkerRequest['type']
  /** Complete converted product and source report. */
  result: DocToDocxResult | DocParseResult
}

/** Stable restored failure, including strict conversion loss reports. */
export interface ConversionWorkerFailure {
  /** Protocol revision. */
  version: 1
  /** Failure discriminator. */
  type: 'error'
  /** Reader, task or strict projection category. */
  code: DocReadErrorCode | 'conversion-loss'
  /** Failure explanation. */
  message: string
  /** Complete report only for a strict projection rejection. */
  report?: DocConversionReport
}

/** Minimal dedicated-worker port for source projection and runtime injection. */
export interface ConversionWorkerScope {
  /** Handler installed by this task's worker entry. */
  onmessage: ((event: MessageEvent<ConversionWorkerRequest>) => void) | null
  /**
   * Posts one complete completion envelope.
   * @param reply - Converted product or restored failure.
   * @param transfers - Exclusively owned output buffers, when present.
   */
  postMessage(reply: ConversionWorkerResult | ConversionWorkerFailure, transfers?: Transferable[]): void
}
