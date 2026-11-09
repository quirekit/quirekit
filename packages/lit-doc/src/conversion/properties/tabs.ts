import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocParagraphTabs } from '../../word/paragraphs/formatting/tabs/types'
import type { ProjectionContext } from '../xml/types'

const alignmentNames = new Map([[0, 'left'], [1, 'center'], [2, 'right'], [3, 'decimal'], [4, 'bar'], [6, 'num']])
const leaderNames = new Map([[0, 'none'], [1, 'dot'], [2, 'hyphen'], [3, 'underscore'], [4, 'underscore'], [5, 'middleDot'], [7, 'none']])

/**
 * Emits only local tab writes, retaining inherited positions in their named style.
 * @param tabs - Effective source state with current-layer changes.
 * @param context - Common XML budget and explicit loss policy.
 * @param source - Owning paragraph, style or numbering level.
 * @returns Zero or one tabs elements in the paragraph property namespace.
 */
export function paragraphTabs(tabs: DocParagraphTabs, context: ProjectionContext, source: string): DocxXmlElementPlan[] {
  if (!tabs.changes.length) return []
  if (tabs.rangeDeletion) context.diagnose({ code: 'tab-deletion-range-approximated', kind: 'approximation', source,
    message: 'Source tab deletion ranges are projected to exact clear positions; future inherited stops inside those ranges require re-evaluation.' })
  if (tabs.changes.some(change => change.position < 0
    || change.value && (![0, 1, 2].includes(change.value.alignment) || change.value.leader === 5)))
    context.diagnose({ code: 'tab-format-host-limit', kind: 'host-limit', source,
      message: 'Tab positions and descriptors are retained in OOXML; Classic native tab layout does not cover every imported negative, decimal, bar, list or middle-dot stop.' })
  return [context.element('tabs', {}, tabs.changes.map(({ position, value }) => context.element('tab',
    value ? { pos: position, val: alignmentNames.get(value.alignment)!, leader: leaderNames.get(value.leader)! }
      : { pos: position, val: 'clear' })))]
}
