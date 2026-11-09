import { DocReadError, requireDoc } from '../../errors'
import { convertDocToDocx, parseDoc } from '../../conversion/api'
import { DocConversionError } from '../../conversion/errors'
import type { DocxParseRuntime } from '../../conversion/types'
import type { ConversionWorkerScope } from './types'

/**
 * Installs full conversion in a dedicated worker, optionally with a statically bundled runtime.
 * @param scope - Exclusively owned worker port.
 * @param runtime - Host-owned statically imported DOCX runtime, or undefined for an explicit module URL.
 */
export function installDocConversionWorker(scope: ConversionWorkerScope, runtime?: DocxParseRuntime): void {
  let used = false
  scope.onmessage = async event => {
    try {
      const request = event.data
      requireDoc(!used && request?.version === 1 && (request.type === 'convert-docx' || request.type === 'parse-doc'), 'invalid-input', 'Invalid or reused DOC conversion worker request')
      used = true
      requireDoc(runtime || typeof request.runtimeModuleUrl === 'string' && request.runtimeModuleUrl.length > 0, 'invalid-input', 'Missing host DOCX runtime module')
      const implementation = runtime ?? await import(/* @vite-ignore */ request.runtimeModuleUrl!) as DocxParseRuntime
      const result = request.type === 'parse-doc' ? await parseDoc(request.input, implementation, request.options)
        : await convertDocToDocx(request.input, implementation, request.options)
      scope.postMessage({ version: 1, type: 'result', operation: request.type, result }, 'docx' in result && result.docx.buffer instanceof ArrayBuffer ? [result.docx.buffer] : [])
    } catch (error) {
      scope.postMessage({ version: 1, type: 'error', code: error instanceof DocConversionError ? error.code : error instanceof DocReadError ? error.code : 'worker-failed',
        message: error instanceof Error ? error.message : 'DOC conversion failed', ...(error instanceof DocConversionError ? { report: error.report } : {}) })
    }
  }
}
