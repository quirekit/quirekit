import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { DocConversionLimits, DocConversionOptions, DocConversionReport } from '../types'
import type { ProjectionContext } from './types'

export const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const defaults: DocConversionLimits = { maxXmlNodes: 500000, maxXmlCodeUnits: 16 * 1024 * 1024, maxDiagnostics: 1000 }
const hard: DocConversionLimits = { maxXmlNodes: 2000000, maxXmlCodeUnits: 64 * 1024 * 1024, maxDiagnostics: 10000 }

/**
 * Owns output counters independently of input parsing limits.
 * @param options - Explicit projection policy and ceilings.
 * @param source - Original denominators.
 * @returns A fresh bounded plan-construction context.
 */
export function createProjectionContext(options: DocConversionOptions, source: DocConversionReport['source']): ProjectionContext {
  requireDoc(options.lossPolicy === undefined || options.lossPolicy === 'strict' || options.lossPolicy === 'best-effort', 'invalid-input', 'Invalid DOC loss policy')
  const limits = { ...defaults, ...options.outputLimits }
  for (const key of Object.keys(defaults) as (keyof DocConversionLimits)[])
    requireDoc(Number.isSafeInteger(limits[key]) && limits[key] >= 1 && limits[key] <= hard[key], 'invalid-input', `Invalid DOC output limit ${key}`)
  const report: DocConversionReport = { route: 'doc-ooxml-docx', lossPolicy: options.lossPolicy ?? 'best-effort', lossy: false,
    diagnostics: [], source, output: { xmlNodes: 0, xmlCodeUnits: 0 } }
  const diagnostics = report.diagnostics as import('../types').DocConversionDiagnostic[]
  const repeated = new Map<string, import('../types').DocConversionDiagnostic>()
  const context: ProjectionContext = { report,
    diagnose(diagnostic) {
      const key = JSON.stringify([diagnostic.code, diagnostic.kind, diagnostic.source, diagnostic.message])
      const prior = repeated.get(key)
      if (prior) { prior.occurrences = (prior.occurrences ?? 1) + 1; return }
      requireDoc(diagnostics.length < limits.maxDiagnostics, 'limit-exceeded', 'DOC conversion diagnostic limit exceeded')
      diagnostics.push(diagnostic); repeated.set(key, diagnostic)
      if (diagnostic.kind === 'loss' || diagnostic.kind === 'approximation') report.lossy = true
    },
    element(name, attributes = {}, children = []): DocxXmlElementPlan {
      const preserveSpace = name === 't' || name === 'instrText' || name === 'delText' || name === 'delInstrText'
      if (preserveSpace) report.output.xmlNodes++
      const result = context.xml({ namespaceUri: wordNamespace, localName: name, prefix: 'w',
        attributes: Object.entries(attributes).map(([localName, value]) => ({ namespaceUri: wordNamespace, localName, prefix: 'w', value })),
        children })
      return preserveSpace ? { ...result, attributes: [...result.attributes,
        { namespaceUri: 'http://www.w3.org/XML/1998/namespace', localName: 'space', prefix: 'xml', value: 'preserve' }] } : result
    },
    xml(element): DocxXmlElementPlan {
      report.output.xmlNodes += 1 + element.attributes.length
      requireDoc(report.output.xmlNodes <= limits.maxXmlNodes, 'limit-exceeded', 'DOC conversion XML node limit exceeded')
      /** @param value - Exact source or projected XML value. @returns Valid XML with diagnosed replacements. */
      function clean(value: string): string {
        report.output.xmlCodeUnits += value.length
        requireDoc(report.output.xmlCodeUnits <= limits.maxXmlCodeUnits, 'limit-exceeded', 'DOC conversion XML text limit exceeded')
        // Strict projection collects the same complete loss report before admission.
        // Best-effort replaces invalid scalars explicitly, never silently dropping them.
        const invalid = /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu
        if (!invalid.test(value)) return value
        context.diagnose({ code: 'invalid-xml-character-replaced', kind: 'loss', source: `xml:${element.localName}`,
          message: 'Forbidden XML controls or lone surrogates are replaced with U+FFFD.' })
        return value.replace(invalid, '\ufffd')
      }
      return { ...element, attributes: element.attributes.map(attribute => ({ ...attribute,
        value: typeof attribute.value === 'object' ? attribute.value : clean(String(attribute.value)) })),
      children: element.children.map(child => typeof child === 'string' ? clean(child) : child) }
    },
  }
  return context
}
