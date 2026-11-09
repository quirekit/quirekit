import { DocReadError, requireDoc } from '../errors'
import type { DocReadErrorCode } from '../types'
import { readDocumentSource } from '../word/document/read'
import { createConversionSource } from './source/read'
import { projectSourceDiagnostics } from './source/diagnostics'
import type { ConversionSource } from './source/types'
import { projectRichDocxSource } from './rich-plan'
import { projectRecoveredText } from './recovery/project'
import { createProjectionContext } from './xml/context'
import type { DocConversionOptions, DocSourcePlanResult } from './types'

const recoverableSourceErrors = new Set<DocReadErrorCode>([
  'invalid-cfb', 'invalid-paragraph-data', 'invalid-formatting-data', 'unsupported-formatting',
  'invalid-table-data', 'unsupported-table', 'invalid-numbering-data', 'unsupported-numbering',
  'invalid-field-data', 'unsupported-field', 'invalid-bookmark-data', 'invalid-comment-data',
  'invalid-revision-data', 'invalid-drawing-data', 'invalid-picture-data', 'unsupported-picture',
])

/**
 * Projects rich DOC content, then recovers validated main-story text after a local source failure.
 * @param input - Complete caller-owned binary Word file.
 * @param options - Loss policy and source/output work ceilings.
 * @returns Atomic typed package graph and located projection or recovery evidence.
 */
export function createDocxSourcePlan(input: Uint8Array, options: DocConversionOptions = {}): DocSourcePlanResult {
  requireDoc(options && typeof options === 'object', 'invalid-input', 'Expected DOC conversion options')
  const context = createProjectionContext(options, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 })
  const document = readDocumentSource(input, options, context.report.lossPolicy === 'strict' ? 'all' : 'requested')
  context.report.source.codeUnits = document.storage.text.length
  let source: ConversionSource | undefined
  let result: DocSourcePlanResult
  try {
    requireDoc(!document.storage.recoveredRange, 'invalid-text-map', 'Core text mapping retained only an independently readable main-story interval')
    requireDoc(!document.header.diagnostics.some(item => item.code === 'fib-locator-prefix-recovered'),
      'invalid-fib', 'The FIB exposes only an actual known locator prefix')
    source = createConversionSource(document, context.report.lossPolicy === 'best-effort')
    context.report.source = { codeUnits: source.storage.text.length, paragraphs: source.paragraphs.length,
      characterRuns: source.runs.length, tables: source.tables.length, styles: source.context.styles.filter(Boolean).length,
      fonts: source.fonts.length, sections: 0 }
    result = projectRichDocxSource(source, context)
  } catch (error) {
    if (context.report.lossPolicy === 'strict' || !(error instanceof DocReadError)
      || !recoverableSourceErrors.has(error.code) && error.code !== 'invalid-fib' && error.code !== 'invalid-text-map') throw error
    if (!source) projectSourceDiagnostics([...document.container.diagnostics, ...document.header.diagnostics], context)
    result = projectRecoveredText(document, context, error, source)
  }
  const acquiredDiagnostics = document.container.diagnostics.length
  for (const diagnostic of document.container.auditUnrequestedStreams()) context.diagnose({ ...diagnostic, kind: 'loss', source: 'container' })
  projectSourceDiagnostics(document.container.diagnostics.slice(acquiredDiagnostics), context)
  return result
}
