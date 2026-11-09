import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocParagraphBaseFormat } from '../../types'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'
import type { ProjectionContext } from '../xml/types'
import { paragraphTabs } from './tabs'
import { paragraphShading } from './shading'

/**
 * Converts admitted paragraph fields while keeping local writes separate from inheritance.
 * @param format - Canonical values after the owning layer.
 * @param fields - Actually written fields, including explicit zero/false.
 * @param context - Bounded XML and report ownership.
 * @param source - Located source authority.
 * @param numbering - Optional already validated numPr delta, placed in schema order.
 * @returns Ordered pPr children; caller owns style references and section/end-mark properties.
 */
export function paragraphProperties(format: DocParagraphBaseFormat, fields: ReadonlySet<ParagraphPropertyKey>, context: ProjectionContext,
  source: string, numbering: readonly DocxXmlElementPlan[] = []): DocxXmlElementPlan[] {
  const e = context.element
  const result: DocxXmlElementPlan[] = []
  for (const name of ['keepNext', 'keepLines', 'pageBreakBefore', 'widowControl'] as const)
    if (fields.has(name)) result.push(e(name, { val: format[name] ? '1' : '0' }))
  result.push(...numbering)
  if (fields.has('shading')) result.push(...paragraphShading(format.shading, context, source))
  if (fields.has('tabs')) result.push(...paragraphTabs(format.tabs, context, source))
  for (const [field, name] of [['autoSpaceLatin', 'autoSpaceDE'], ['autoSpaceNumber', 'autoSpaceDN']] as const)
    if (fields.has(field)) result.push(e(name, { val: format[field] ? '1' : '0' }))
  if (fields.has('bidi')) result.push(e('bidi', { val: format.bidi ? '1' : '0' }))
  const spacing: Record<string, string | number> = {}
  if (fields.has('spacingBeforeTwips')) spacing.before = format.spacingBeforeTwips
  if (fields.has('spacingAfterTwips')) spacing.after = format.spacingAfterTwips
  if (fields.has('lineSpacing')) {
    const { value, multiple } = format.lineSpacing
    spacing.line = Math.abs(value)
    spacing.lineRule = value < 0 ? 'exact' : multiple ? 'auto' : 'atLeast'
  }
  if (Object.keys(spacing).length) result.push(e('spacing', spacing))
  const indents: Record<string, number> = {}
  if (fields.has('leftIndent')) indents[format.leftIndent.logical ? 'start' : 'left'] = format.leftIndent.twips
  if (fields.has('rightIndent')) indents[format.rightIndent.logical ? 'end' : 'right'] = format.rightIndent.twips
  if (fields.has('firstLineIndentTwips')) indents[format.firstLineIndentTwips < 0 ? 'hanging' : 'firstLine'] = Math.abs(format.firstLineIndentTwips)
  if (Object.keys(indents).length) result.push(e('ind', indents))
  if (fields.has('alignment')) {
    const { logical, value } = format.alignment
    const values = logical ? ['start', 'center', 'end', 'both', 'distribute', 'mediumKashida', 'start', 'highKashida', 'lowKashida', 'thaiDistribute']
      : ['left', 'center', 'right', 'both', 'mediumKashida', 'highKashida']
    if (!logical && value >= 4) context.diagnose({ code: 'physical-compression-alignment-approximated', kind: 'approximation', source,
      message: 'Legacy physical compression justification uses the corresponding OOXML Kashida/compression level; Arabic behavior requires separate validation.' })
    if (logical && value === 6) context.diagnose({ code: 'indented-justification-approximated', kind: 'approximation', source,
      message: 'The source indented justification has no direct OOXML equivalent; best-effort uses logical start alignment.' })
    result.push(e('jc', { val: values[value]! }))
  }
  if (fields.has('alignment') && format.alignment.logical && [0, 2].includes(format.alignment.value)
    || fields.has('leftIndent') && format.leftIndent.logical || fields.has('rightIndent') && format.rightIndent.logical)
    context.diagnose({ code: 'logical-paragraph-format-host-limit', kind: 'host-limit', source,
      message: 'Logical paragraph basis is preserved in OOXML; current LitAST/Classic native layout does not cover every start/end property.' })
  if (fields.has('outlineLevel')) result.push(e('outlineLvl', { val: format.outlineLevel }))
  return result
}
