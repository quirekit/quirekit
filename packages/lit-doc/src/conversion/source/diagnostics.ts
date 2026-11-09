import type { DocReadDiagnostic } from '../../types'
import type { ProjectionContext } from '../xml/types'

/**
 * Preserves the distinction between omitted source content and metadata compatibility.
 * @param diagnostics - Actual source deviations acquired so far.
 * @param context - Shared output report and diagnostic ceiling.
 */
export function projectSourceDiagnostics(diagnostics: readonly DocReadDiagnostic[], context: ProjectionContext): void {
  for (const diagnostic of diagnostics) context.diagnose({ ...diagnostic,
    kind: ['cfb-stream-truncated', 'cfb-directory-recovered', 'cfb-flat-directory-recovered'].includes(diagnostic.code) ? 'loss' : 'compatibility',
    source: 'container' })
}
