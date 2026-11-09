import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import { resolveParagraphNumbering } from '../../word/numbering/references'
import type { DocNumberingRecords, ParagraphNumberingState } from '../../word/numbering/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Validates final source references before any part or reference is installed.
 * @param states - Final paragraph or named-style states with local provenance.
 * @param records - Complete validated source numbering graph.
 * @returns Positive instance identities actually required by these states.
 */
export function referencedInstances(states: readonly ParagraphNumberingState[], records: DocNumberingRecords): number[] {
  return states.flatMap(state => {
    const reference = resolveParagraphNumbering(state, records)
    requireDoc(!reference.keepLogicalIndentation, 'unsupported-numbering', 'Negative list references require a separate logical-indentation projection')
    return reference.instanceIndex !== null && reference.level !== 12 ? [reference.instanceIndex] : []
  })
}

/**
 * Isolates an old style authority without inheriting an unrelated modern list.
 * @param state - Final named-style reference, including inherited values.
 * @param index - Original style owner for an explicit loss.
 * @param context - Bounded XML and strict-admission report.
 * @returns Modern style delta or a diagnosed explicit list cancellation.
 */
export function styleNumberingReference(state: ParagraphNumberingState, index: number, context: ProjectionContext): DocxXmlElementPlan[] {
  if (state.rawIndex !== 0x7ff) return numberingReference(state, context)
  context.diagnose({ code: 'legacy-style-numbering-unprojected', kind: 'loss', source: `style:${index}`,
    message: 'The old ANLD style reference is not a modern list instance. Its numbering is explicitly cancelled while the independent modern graph is retained.' })
  return [context.element('numPr', {}, [context.element('numId', { val: 0 })])]
}

/**
 * Emits only this layer's changes, preserving inheritance and explicit cancellation.
 * @param state - Final values with flags confined to this paragraph or style.
 * @param context - Bounded XML owner.
 * @returns A numPr child or an empty delta.
 */
export function numberingReference(state: ParagraphNumberingState, context: ProjectionContext): DocxXmlElementPlan[] {
  if (!state.referenceChanged && !state.levelChanged) return []
  const e = context.element
  const children: DocxXmlElementPlan[] = []
  if (state.levelChanged && state.rawLevel <= 8) children.push(e('ilvl', { val: state.rawLevel }))
  if (state.rawLevel === 12) children.push(e('numId', { val: 0 }))
  else if (state.referenceChanged) children.push(e('numId', { val: state.rawIndex === 0xf801 ? 0 : state.rawIndex }))
  return children.length ? [e('numPr', {}, children)] : []
}
