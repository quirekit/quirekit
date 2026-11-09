import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { ConversionSource } from '../source/types'
import { findSourceInterval } from '../source/lookup'
import type { ProjectionContext } from '../xml/types'
import { revisionAttributes, revisionRunAttributes } from './metadata'

/**
 * Projects an authored ordinary paragraph boundary independently of its visible text.
 * @param source - Exact paragraph, character and table authorities.
 * @param paragraphIndex - Original paragraph slot.
 * @param runIndex - Source interval owning its ending character.
 * @param storyEnd - Exclusive actual Story output boundary.
 * @param sectionEnd - Whether this paragraph carries a section transition.
 * @param context - Located explicit support policy.
 * @returns Native mark carrier and whether active source flags were admitted.
 */
export function projectParagraphRevision(source: ConversionSource, paragraphIndex: number, runIndex: number,
  storyEnd: number, sectionEnd: boolean, context: ProjectionContext): { children: DocxXmlElementPlan[], handled: boolean } {
  const run = source.runRevisions[runIndex]!, paragraph = source.paragraphs[paragraphIndex]!
  const sessions = revisionRunAttributes(run, context)
  if (Object.keys(sessions).length) context.diagnose({ code: 'revision-marker-save-session-unprojected', kind: 'loss', source: 'revision',
    start: paragraph.end - 1, end: paragraph.end,
    message: 'Paragraph-mark save sessions require their own paragraph attribute mapping and are not serialized as an inline text run.' })
  if (!run.inserted && !run.deleted) return { children: [], handled: true }
  const table = source.topTables[findSourceInterval(source.topTables, paragraph.start)]
  const next = source.paragraphs[paragraphIndex + 1]
  const boundary = !table || table.start > paragraph.end
  if (paragraph.start >= source.header.stories[0]!.end || run.inserted && run.deleted || paragraph.ending !== 'paragraph' || sectionEnd || paragraph.end >= storyEnd
    || !boundary || next?.start !== paragraph.end) {
    context.diagnose({ code: 'revision-paragraph-boundary-unprojected', kind: 'loss', source: 'revision',
      start: paragraph.end - 1, end: paragraph.end,
      message: 'This reviewed ending is a table/section/final/dual boundary outside the ordinary paragraph-mark lifecycle; no visible newline or inline review is fabricated.' })
    return { children: [], handled: false }
  }
  return { handled: true, children: [context.element(run.deleted ? 'del' : 'ins',
    revisionAttributes(source, run, run.deleted ? 'deletion' : 'insertion', context))] }
}
