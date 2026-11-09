import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocShading } from '../../word/formatting/shading/types'
import { shadingPattern } from '../../word/formatting/shading/patterns'
import type { ProjectionContext } from '../xml/types'

/** @param shading - Explicit source shading. @param context - Output report and budget. @param source - Owning paragraph/style. @returns Exact standard shading, or an explicitly diagnosed unsupported pattern. */
export function paragraphShading(shading: DocShading | null, context: ProjectionContext, source: string): DocxXmlElementPlan[] {
  if (!shading) return []
  const pattern = shadingPattern(shading.pattern)
  if (pattern === undefined) {
    context.diagnose({ code: 'paragraph-shading-pattern-unprojected', kind: 'loss', source,
      message: `Source paragraph shading pattern ${shading.pattern} has no exact admitted OOXML mapping; this shading is omitted.` })
    return []
  }
  if (pattern !== 'clear' && pattern !== 'nil') context.diagnose({ code: 'paragraph-shading-pattern-host-limit', kind: 'host-limit', source,
    message: 'The standard paragraph shading pattern and colors are retained; current Classic native paint uses only the background fill.' })
  return [context.element('shd', { val: pattern, color: pattern === 'nil' ? 'auto' : shading.foreground, fill: pattern === 'nil' ? 'auto' : shading.background })]
}
