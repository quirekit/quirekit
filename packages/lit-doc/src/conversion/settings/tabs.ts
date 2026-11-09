import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { WordDocumentSource } from '../../word/document/types'
import { readDefaultTabInterval } from '../../word/settings/tabs'
import { recoverStorySource } from '../source/policy'
import type { ProjectionContext } from '../xml/types'

/**
 * Projects the document interval independently of paragraph custom stops.
 * @param source - Original DOP bytes and locator.
 * @param context - Output budget and explicit loss policy.
 * @returns A literal settings child, or undefined when absent or explicitly lost.
 */
export function projectDefaultTabInterval(source: WordDocumentSource, context: ProjectionContext): DocxXmlElementPlan | undefined {
  try {
    const interval = readDefaultTabInterval(source.table, source.header)
    if (interval === null) return undefined
    requireDoc(interval > 0, 'invalid-formatting-data', `Invalid default tab interval ${interval}; a positive twip distance is required`)
    return context.element('defaultTabStop', { val: interval })
  } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'default-tab-interval-unprojected', kind: 'loss', source: 'document:defaultTabStop',
      message: `Document default tab interval is omitted (${error.code}: ${error.message}); source paragraph stops remain independent.` })
    return undefined
  }
}
