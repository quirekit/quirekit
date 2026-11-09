import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { DocTableBlock } from '../../word/tables/types'
import { findSourceInterval } from '../source/lookup'
import type { ConversionSource } from '../source/types'
import type { StyleProjection } from '../styles/types'
import type { NumberingProjection } from '../numbering/types'
import type { PictureProjection } from '../pictures/types'
import type { ProjectionContext } from '../xml/types'
import { projectSourceTable } from '../tables'
import { createBodyProjection } from './paragraphs'
import type { StoryProjectionRange } from './types'
import type { NoteControlProjection } from '../notes/types'
import type { CommentControlProjection } from '../comments/types'

/**
 * Projects one bounded story with shared canonical tables and independent field state.
 * @param source - Canonical arrays for the complete source subdocument.
 * @param styles - Shared named-style owner.
 * @param context - Document-wide XML budget and loss policy.
 * @param range - Exact content boundaries and optional main-body section transitions.
 * @param numbering - Complete shared numbering graph.
 * @param pictures - This part's image relationships and shared media decoding budget.
 * @param notes - Optional note controls owned by the current story.
 * @param comments - Optional main comment references/ranges or message self marker.
 * @returns Complete paragraph/table children in source order.
 */
export function projectStoryBlocks(source: ConversionSource, styles: StyleProjection, context: ProjectionContext,
  range: StoryProjectionRange, numbering?: NumberingProjection, pictures?: PictureProjection, notes?: NoteControlProjection,
  comments?: CommentControlProjection): DocxXmlElementPlan[] {
  const body = createBodyProjection(source, styles, context, numbering, pictures, range, notes, comments)
  const sections = range.sections ?? []
  const sectionEnds = new Map(sections.slice(0, -1).map(section => [section.end, section.properties]))
  const children: DocxXmlElementPlan[] = []
  let index = findSourceInterval(source.paragraphs, range.start)
  let tableIndex = findSourceInterval(source.topTables, range.start)
  const firstTable = source.topTables[tableIndex]
  requireDoc(!firstTable || firstTable.start >= range.start, 'invalid-story-data', 'Story starts inside another table')
  requireDoc(source.paragraphs[index]?.start === range.start, 'invalid-story-data', 'Story starts inside a source paragraph')

  /** @param index - Canonical paragraph slot. @param positioned - Whether its table owns frame placement. @returns Paragraph with its own main-body section transition. */
  function paragraph(index: number, positioned = false): DocxXmlElementPlan {
    return body.paragraph(index, sectionEnds.get(source.paragraphs[index]!.end), positioned)
  }

  /** @param blocks - Canonical ordered cell children. @param positioned - Current table placement authority. @returns Complete cell XML without index remapping. */
  function blocks(blocks: readonly DocTableBlock[], positioned: boolean): DocxXmlElementPlan[] {
    return blocks.map(block => block.kind === 'paragraph' ? paragraph(block.index, positioned) : table(block.index))
  }

  /** @param index - Canonical table slot. @returns A complete table within the current story and section. */
  function table(index: number): DocxXmlElementPlan {
    const value = source.tables[index]!
    requireDoc(value.start >= range.start && value.end <= range.end, 'invalid-story-data', 'Table crosses a story boundary')
    requireDoc(!sections.some(section => section.end > value.start && section.end < value.end),
      'unsupported-table', 'Section boundaries inside a table require a dedicated projection')
    return projectSourceTable(source, index, children => blocks(children, !!value.identity.position), context)
  }

  // Look up the first paragraph and table once. Each successful interval then
  // advances monotonically, including nested cell paragraphs through the same owner.
  let end = range.start
  while (index < source.paragraphs.length && source.paragraphs[index]!.start < range.end) {
    const current = source.paragraphs[index]!
    requireDoc(current.end <= range.end, 'invalid-story-data', 'Story ends inside a source paragraph')
    const top = source.topTables[tableIndex]
    if (top?.start === current.start) {
      children.push(table(top.index))
      end = top.end
      while (index < source.paragraphs.length && source.paragraphs[index]!.end <= end) index++
      tableIndex++
    } else { children.push(paragraph(index)); end = current.end; index++ }
  }
  requireDoc(end === range.end, 'invalid-story-data', 'Story content has incomplete paragraph coverage')
  return body.finish(children)
}
