import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { ConversionSource } from '../source/types'
import type { ProjectedSection } from '../sections/types'
import type { StyleProjection } from '../styles/types'
import type { NumberingProjection } from '../numbering/types'
import type { PictureProjection } from '../pictures/types'
import type { ProjectionContext } from '../xml/types'
import { projectStoryBlocks } from './story'
import type { NoteControlProjection } from '../notes/types'
import type { CommentControlProjection } from '../comments/types'

/**
 * Wraps main-story block topology with independently owned section properties.
 * @param source - Canonical main-story intervals and tables.
 * @param styles - Named style projection.
 * @param sections - Independent page tuples in source order.
 * @param context - Bounded XML and loss-report owner.
 * @param numbering - Optional complete numbering graph and direct-reference projector.
 * @param pictures - Optional displayed picture and media graph owner.
 * @param notes - Optional verified main-story note references.
 * @param comments - Optional verified main-story comment references and ranges.
 * @returns Complete typed document root.
 */
export function projectDocument(source: ConversionSource, styles: StyleProjection, sections: readonly ProjectedSection[], context: ProjectionContext,
  numbering?: NumberingProjection, pictures?: PictureProjection, notes?: NoteControlProjection, comments?: CommentControlProjection): DocxXmlElementPlan {
  const children = projectStoryBlocks(source, styles, context, { start: 0, end: source.header.stories[0]!.end, sections }, numbering, pictures, notes, comments)
  children.push(sections[sections.length - 1]!.properties)
  return context.element('document', {}, [context.element('body', {}, children)])
}
