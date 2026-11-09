import { requireDoc } from '../errors'
import { createDocxSourcePlan } from './plan'
import type { DocConversionOptions, DocParseOptions, DocParseResult, DocToDocxResult, DocxConversionRuntime, DocxParseRuntime } from './types'

/**
 * Converts DOC through the host's existing OOXML compiler without downloading tools or content.
 * @param input - Complete original binary Word bytes; caller storage is retained.
 * @param runtime - Host-owned central DOCX resolver and materializer.
 * @param options - Source/output limits and explicit loss policy.
 * @returns Generated DOCX and the complete source projection report.
 */
export async function convertDocToDocx(input: Uint8Array, runtime: DocxConversionRuntime, options: DocConversionOptions = {}): Promise<DocToDocxResult> {
  requireDoc(runtime && typeof runtime.resolveDocxPackageSourcePlan === 'function' && typeof runtime.materializeNewDocxPackagePlan === 'function',
    'invalid-input', 'Expected a host-owned DOCX conversion runtime')
  const { plan, report } = createDocxSourcePlan(input, options)
  const docx = await runtime.materializeNewDocxPackagePlan(runtime.resolveDocxPackageSourcePlan(plan))
  requireDoc(docx instanceof Uint8Array, 'invalid-input', 'DOCX runtime returned invalid package bytes')
  return { docx, report }
}

/**
 * Parses DOC through the same typed OOXML route and the existing LitAST codec.
 * @param input - Complete original binary Word bytes.
 * @param runtime - Host-owned DOCX compiler and parser, with its own license policy.
 * @param options - Conversion policy plus existing parser options.
 * @returns LitAST, parser warnings and the separate source conversion report.
 */
export async function parseDoc(input: Uint8Array, runtime: DocxParseRuntime, options: DocParseOptions = {}): Promise<DocParseResult> {
  requireDoc(runtime && typeof runtime.parseDocx === 'function', 'invalid-input', 'Expected the host DOCX parser')
  const { docx, report } = await convertDocToDocx(input, runtime, options)
  const parsed = await runtime.parseDocx(docx, options.parseOptions)
  return { ...parsed, report }
}
