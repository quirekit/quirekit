import { resolveLimits } from '../../binary/limits'
import { DocReadError, requireDoc } from '../../errors'
import type { DocParseResult, DocToDocxResult } from '../../conversion/types'
import type { ConversionWorkerRequest } from '../../worker/conversion/types'
import { createProjectionContext } from '../../conversion/xml/context'
import { runOwnedWorkerTask } from '../task/run'
import { readConversionReply } from './reply'
import type { DocConversionWorkerOptions } from './types'

/**
 * Runs parsing, typed projection and the injected OOXML runtime in one dedicated worker.
 * @param input - Caller-owned original DOC bytes.
 * @param operation - Requested final package or LitAST product.
 * @param options - Explicit host assembly, source/output and task-lifetime policy.
 * @returns Complete product after worker and host resources have been released.
 */
export async function runConversionWorker(input: Uint8Array, operation: ConversionWorkerRequest['type'],
  options: DocConversionWorkerOptions): Promise<DocToDocxResult | DocParseResult> {
  requireDoc(input instanceof Uint8Array && options && typeof options === 'object', 'invalid-input', 'Expected DOC bytes and conversion worker options')
  const limits = resolveLimits(options)
  requireDoc(input.byteLength <= limits.maxInputBytes, 'limit-exceeded', 'Input byte limit exceeded')
  const timeoutMs = options.timeoutMs ?? 20000
  requireDoc(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, 'invalid-input', 'Invalid worker timeout')
  if (options.signal?.aborted) throw new DocReadError('aborted', 'DOC conversion was cancelled')
  createProjectionContext(options, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 })
  requireDoc(options.createWorker || typeof options.runtimeModuleUrl === 'string' && options.runtimeModuleUrl.length > 0,
    'invalid-input', 'Supply a host DOCX runtime module URL or a statically assembled conversion worker')
  const bytes = new Uint8Array(input)
  const request: ConversionWorkerRequest = { version: 1, type: operation, input: bytes, options: { limits,
    ...(options.lossPolicy === undefined ? {} : { lossPolicy: options.lossPolicy }),
    ...(options.outputLimits === undefined ? {} : { outputLimits: options.outputLimits }),
    ...(options.parseOptions === undefined ? {} : { parseOptions: options.parseOptions }) },
    ...(options.runtimeModuleUrl === undefined ? {} : { runtimeModuleUrl: new URL(options.runtimeModuleUrl, globalThis.location?.href ?? import.meta.url).href }) }
  return runOwnedWorkerTask(request, [bytes.buffer], { ...(options.signal ? { signal: options.signal } : {}), timeoutMs,
    createWorker: options.createWorker ?? (() => new Worker(new URL('./conversion-worker.mjs', import.meta.url), { type: 'module' })) }, value => readConversionReply(value, operation))
}

/**
 * Converts DOC fully inside a worker without detaching the caller's bytes.
 * @param input - Original complete DOC bytes.
 * @param options - Host runtime, loss and task policy.
 * @returns Generated package and complete source projection report.
 */
export async function convertDocToDocxInWorker(input: Uint8Array, options: DocConversionWorkerOptions = {}): Promise<DocToDocxResult> {
  return await runConversionWorker(input, 'convert-docx', options) as DocToDocxResult
}

/**
 * Parses DOC through OOXML and LitAST fully inside a worker.
 * @param input - Original complete DOC bytes.
 * @param options - Host runtime, conversion and existing parser policy.
 * @returns LitAST, codec warnings and source projection report.
 */
export async function parseDocInWorker(input: Uint8Array, options: DocConversionWorkerOptions = {}): Promise<DocParseResult> {
  return await runConversionWorker(input, 'parse-doc', options) as DocParseResult
}
