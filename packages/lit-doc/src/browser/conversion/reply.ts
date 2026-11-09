import { DocReadError, requireDoc } from '../../errors'
import { DocConversionError } from '../../conversion/errors'
import type { DocConversionReport, DocParseResult, DocToDocxResult } from '../../conversion/types'
import type { ConversionWorkerFailure, ConversionWorkerResult, ConversionWorkerRequest } from '../../worker/conversion/types'

/**
 * Checks the complete report contract before accepting a different/older worker implementation.
 * @param value - Untrusted structured-clone report.
 * @returns Whether core counters, policy and located diagnostic structure are present.
 */
function isReport(value: unknown): value is DocConversionReport {
  if (!value || typeof value !== 'object') return false
  const report = value as DocConversionReport
  return report.route === 'doc-ooxml-docx' && ['strict', 'best-effort'].includes(report.lossPolicy) && typeof report.lossy === 'boolean'
    && Array.isArray(report.diagnostics) && report.diagnostics.every(diagnostic => diagnostic && typeof diagnostic.code === 'string'
      && typeof diagnostic.source === 'string' && typeof diagnostic.message === 'string' && ['loss', 'approximation', 'host-limit', 'compatibility'].includes(diagnostic.kind))
    && !!report.source && ['codeUnits', 'paragraphs', 'characterRuns', 'tables', 'styles', 'fonts', 'sections'].every(key => Number.isSafeInteger(report.source[key as keyof typeof report.source]) && report.source[key as keyof typeof report.source] >= 0)
    && !!report.output && ['xmlNodes', 'xmlCodeUnits'].every(key => Number.isSafeInteger(report.output[key as keyof typeof report.output]) && report.output[key as keyof typeof report.output] >= 0)
    && isRecovery(report)
}

/** @param report - Otherwise validated worker report. @returns Whether recovery includes its loss, display-state and unavailable-count evidence. */
function isRecovery(report: DocConversionReport): boolean {
  const value = report.recovery
  if (value === undefined) return true
  return !!value && value.level === 'text' && typeof value.cause === 'string' && value.cause.length > 0
    && report.lossPolicy === 'best-effort' && report.lossy
    && report.diagnostics.some(item => item.code === 'document-text-recovered' && item.kind === 'loss')
    && Array.isArray(value.unresolvedTextSemantics)
    && value.unresolvedTextSemantics.every(item => ['hidden-formatting', 'tracked-changes'].includes(item))
    && new Set(value.unresolvedTextSemantics).size === value.unresolvedTextSemantics.length
    && Array.isArray(value.unmeasuredSourceCounts)
    && value.unmeasuredSourceCounts.every(item => ['paragraphs', 'characterRuns', 'tables', 'styles', 'fonts', 'sections'].includes(item)
      && report.source[item as keyof typeof report.source] === 0)
    && new Set(value.unmeasuredSourceCounts).size === value.unmeasuredSourceCounts.length
}

/**
 * Restores strict loss failures and refuses success replies for a different requested product.
 * @param value - Completion envelope from the task-owned worker.
 * @param operation - Requested final product.
 * @returns Validated converted package or LitAST result.
 */
export function readConversionReply(value: unknown, operation: ConversionWorkerRequest['type']): DocToDocxResult | DocParseResult {
  const reply = value as ConversionWorkerResult | ConversionWorkerFailure
  requireDoc(reply && reply.version === 1 && (reply.type === 'result' || reply.type === 'error'), 'worker-failed', 'Invalid DOC conversion worker reply')
  if (reply.type === 'error') {
    if (reply.code === 'conversion-loss') {
      requireDoc(isReport(reply.report) && reply.report.lossy && reply.report.lossPolicy === 'strict', 'worker-failed', 'Invalid strict conversion report')
      throw new DocConversionError(reply.report)
    }
    throw new DocReadError(reply.code, reply.message)
  }
  requireDoc(reply.operation === operation && reply.result && isReport(reply.result.report), 'worker-failed', 'DOC conversion worker omitted the requested product or report')
  requireDoc(!(reply.result.report.lossPolicy === 'strict' && reply.result.report.lossy), 'worker-failed', 'Worker admitted strict semantic loss')
  if (operation === 'convert-docx') requireDoc('docx' in reply.result && reply.result.docx instanceof Uint8Array, 'worker-failed', 'Invalid DOCX worker product')
  else requireDoc('ast' in reply.result && reply.result.ast?.type === 'document' && Array.isArray(reply.result.warnings), 'worker-failed', 'Invalid LitAST worker product')
  return reply.result
}
