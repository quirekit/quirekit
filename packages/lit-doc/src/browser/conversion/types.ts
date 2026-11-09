import type { ParseOptions } from '@quirekit/lit-docx-contract'
import type { DocConversionOptions } from '../../conversion/types'

/** Browser conversion policy for an exclusively owned module worker. */
export interface DocConversionWorkerOptions extends DocConversionOptions {
  /** Cancels parsing, XML projection and the DOCX runtime by terminating the worker. */
  signal?: AbortSignal
  /** Total lifetime including runtime startup; defaults to 20000 ms, maximum 120000 ms. */
  timeoutMs?: number
  /** Host-selected DOCX runtime module URL; file content can never select this module. */
  runtimeModuleUrl?: string
  /** Serializable existing parser options; callbacks/plugins belong in the host worker assembly. */
  parseOptions?: Pick<ParseOptions, 'preserveRawXml' | 'numberingMode' | 'malformedFieldMode' | 'chartSourceLimits'>
  /**
   * Creates a fresh bundler-managed worker with an installed conversion handler.
   * @returns Dedicated worker owned and terminated by this call.
   */
  createWorker?: () => Worker
}
