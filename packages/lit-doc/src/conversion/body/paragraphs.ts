import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { paragraphFrameOpcodes } from '../../word/tables/position'
import { requireDoc } from '../../errors'
import { characterProperties, styleToggles } from '../properties/characters'
import { paragraphProperties } from '../properties/paragraphs'
import { findSourceInterval } from '../source/lookup'
import type { ConversionSource } from '../source/types'
import type { NumberingProjection } from '../numbering/types'
import type { PictureProjection } from '../pictures/types'
import { styleId } from '../styles/identity'
import { diagnoseUnsupported } from '../styles/project'
import type { StyleProjection } from '../styles/types'
import type { ProjectionContext } from '../xml/types'
import { withSourceRange } from '../xml/location'
import { projectInline } from './inline'
import type { BodyProjection } from './types'
import type { NoteControlProjection } from '../notes/types'
import type { CommentControlProjection } from '../comments/types'
import { createFieldProjection } from '../fields/projection'
import { createBookmarkProjection } from '../bookmarks/projection'
import type { StoryProjectionRange } from './types'
import { projectInlineRevision } from '../revisions/inline'
import { projectParagraphRevision } from '../revisions/marker'
import { revisionMetadataOpcodes } from '../../word/revisions/runs'

/**
 * Owns monotonically ordered source-run consumption and story-wide field frames.
 * @param source - Complete canonical source paragraphs, values and provenance.
 * @param styles - Named target styles and source baseline snapshots.
 * @param context - Bounded XML and source projection decisions.
 * @param numbering - Atomic numbering graph and paragraph-local reference deltas.
 * @param pictures - Optional current-story picture and media owner.
 * @param range - Exact CP interval owned by this independent story.
 * @param notes - Optional owner for exact source note controls.
 * @param comments - Optional main comment references/ranges or message self marker.
 * @returns Ordered paragraph producer used by the body/table traversal.
 */
export function createBodyProjection(source: ConversionSource, styles: StyleProjection, context: ProjectionContext, numbering?: NumberingProjection,
  pictures?: PictureProjection, range: StoryProjectionRange = { start: 0, end: source.header.stories[0]!.end }, notes?: NoteControlProjection,
  comments?: CommentControlProjection): BodyProjection {
  const e = context.element
  const fields = createFieldProjection(source, range, context)
  const bookmarks = createBookmarkProjection(source, range, context)
  let runIndex = findSourceInterval(source.runs, range.start)
  let previousEnd = range.start
  const structureCodes = new Set([0x2416, 0x2417, 0x6649, 0x664a, 0x244b, 0x244c])

  /**
   * Writes direct rPr and only the specific fields needed for source character-style context.
   * @param index - Canonical source run slot.
   * @param reviewHandled - Whether the separate review owner admitted the effective content flags.
   * @returns Complete direct run-property children.
   */
  function runProperties(index: number, reviewHandled: boolean): DocxXmlElementPlan[] {
    const run = source.runs[index]!
    const format = run.baseFormat
    const direct = new Set(source.runFields[index])
    if (reviewHandled) { direct.delete('inserted'); direct.delete('deleted') }
    for (const [field, mode] of source.runToggleModes[index]!) {
      if (reviewHandled && (field === 'inserted' || field === 'deleted')) continue
      if (mode === 0x80) direct.delete(field)
      else if (mode === 0x81) context.diagnose({ code: 'direct-inverse-toggle-approximated', kind: 'approximation', source: 'character',
        start: run.start, end: run.end, message: `Source inverse-style ${field} uses an explicit current value; future style edits follow OOXML direct formatting.` })
    }
    const paragraph = styles.paragraphs.get(format.paragraphStyleIndex)!
    const character = styles.characters.get(format.characterStyleIndex)
    if (character) for (const [field] of styleToggles) {
      if (direct.has(field)) continue
      const projected = Boolean(paragraph[field]) !== (Boolean(character[field]) !== Boolean(styles.normal[field]))
      if (projected !== format[field]) {
        direct.add(field)
        context.diagnose({ code: 'character-style-context-compensated', kind: 'approximation', source: `style:${format.characterStyleIndex}`,
          start: run.start, end: run.end, message: `The source absolute ${field} value requires a targeted direct override in this paragraph context.` })
      }
    }
    const located = withSourceRange(context, run.start, run.end)
    if (pictures?.handledRuns.has(index) && /^[\u0001\u0008]+$/u.test(source.storage.text.slice(run.start, run.end))) direct.delete('special')
    if (notes?.handledRuns.has(index) && /^\u0002+$/u.test(source.storage.text.slice(run.start, run.end))) direct.delete('special')
    if (comments?.handledRuns.has(index) && /^\u0005+$/u.test(source.storage.text.slice(run.start, run.end))) direct.delete('special')
    if (fields.handledRuns.has(index) && /^[\u0013-\u0015]+$/u.test(source.storage.text.slice(run.start, run.end))) direct.delete('special')
    const result = characterProperties(format, direct, source.fonts, located, 'character')
    if (format.characterStyleIndex !== 10) {
      requireDoc(character, 'invalid-formatting-data', 'Run character style was not projected')
      result.unshift(e('rStyle', { val: styleId(format.characterStyleIndex) }))
    }
    diagnoseUnsupported(format.unsupportedOpcodes.filter(code => !revisionMetadataOpcodes.has(code)
      && (!pictures?.handledRuns.has(index) || ![0x6a03, 0x0806, 0x0856, 0x080a].includes(code))), 'character', located)
    return result
  }

  /**
   * Projects text and the separately owned paragraph-mark formatting in source order.
   * @param index - Canonical paragraph slot.
   * @param section - Optional nonfinal section properties.
   * @param tablePositioned - Whether the table owns the effective frame placement.
   * @returns Complete typed paragraph.
   */
  function paragraph(index: number, section?: DocxXmlElementPlan, tablePositioned = false): DocxXmlElementPlan {
    const record = source.paragraphs[index]!
    requireDoc(record.start >= previousEnd, 'invalid-paragraph-data', 'Body projection must follow source order')
    previousEnd = record.end
    fields.enterParagraph(index)
    const located = withSourceRange(context, record.start, record.end)
    const textEnd = record.end - 1
    while (source.runs[runIndex] && source.runs[runIndex]!.end <= record.start) runIndex++
    const children: DocxXmlElementPlan[] = []
    let position = record.start
    while (position < textEnd) {
      children.push(...bookmarks.at(position, fields.inInstruction, fields.inField))
      children.push(...(comments?.boundaries?.at(position, fields.inField) ?? []))
      while (source.runs[runIndex] && source.runs[runIndex]!.end <= position) runIndex++
      const run = source.runs[runIndex]
      requireDoc(run && run.start <= position && run.end > position, 'invalid-formatting-data', 'Run coverage does not cover source text')
      const cut = bookmarks.next(Math.min(run.end, textEnd))
      const end = comments?.boundaries?.next(cut) ?? cut
      const review = projectInlineRevision(source, runIndex, position, end, fields.inField, located)
      const inline = projectInline(source.storage.text, position, end, textEnd, fields, context,
        pictures ? cp => pictures.project(cp, runIndex) : undefined, notes ? cp => notes.project(cp, runIndex) : undefined,
        comments ? (cp, inField) => comments.project(cp, runIndex, inField) : undefined,
        pictures ? cp => pictures.projectFloating(cp, runIndex) : undefined)
      if (inline.children.length) {
        const properties = runProperties(runIndex, review.handled)
        children.push(review.wrap(e('r', review.attributes, [...(properties.length ? [e('rPr', {}, properties)] : []), ...inline.children])))
      }
      position = inline.next
    }
    children.push(...bookmarks.at(textEnd, fields.inInstruction, fields.inField))
    children.push(...(comments?.boundaries?.at(textEnd, fields.inField) ?? []))
    while (source.runs[runIndex] && source.runs[runIndex]!.end <= textEnd) runIndex++
    requireDoc(source.runs[runIndex] && source.runs[runIndex]!.start <= textEnd && source.runs[runIndex]!.end >= record.end,
      'invalid-formatting-data', 'Paragraph marker has no complete run authority')
    const pPr = [e('pStyle', { val: styleId(source.paragraphFormats[index]!.styleIndex) }),
      ...paragraphProperties(source.paragraphFormats[index]!, source.paragraphFields[index]!, located, 'paragraph', numbering?.paragraph(index, source))]
    const markRevision = projectParagraphRevision(source, index, runIndex, range.end, !!section, located)
    const marker = [...runProperties(runIndex, markRevision.handled), ...markRevision.children]
    if (marker.length) pPr.push(e('rPr', {}, marker))
    if (section) pPr.push(section)
    const unsupported = source.paragraphFormats[index]!.unsupportedOpcodes
    if (tablePositioned && unsupported.some(code => paragraphFrameOpcodes.has(code))) located.diagnose({
      code: 'table-frame-position-overridden', kind: 'compatibility', source: 'paragraph',
      message: 'Independent table positioning overrides redundant paragraph-frame properties inside this table.' })
    diagnoseUnsupported(unsupported.filter(code => (!tablePositioned || !paragraphFrameOpcodes.has(code)) && !structureCodes.has(code) && (code >>> 10 & 7) !== 5
      && (!numbering?.handled || code !== 0x460b && code !== 0x260a)), 'paragraph', located)
    return e('p', {}, [e('pPr', {}, pPr), ...children])
  }
  return { paragraph,
    /** @param blocks - Complete typed Story. @returns Atomically admitted field and bookmark output. */
    finish(blocks) { fields.finish(); return bookmarks.finish(blocks) } }
}
