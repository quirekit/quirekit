import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { DocCommentEntry } from '../../word/comments/types'
import { projectStoryBlocks } from '../body/story'
import { findSourceInterval } from '../source/lookup'
import type { ConversionSource } from '../source/types'
import type { StyleProjection } from '../styles/types'
import type { NumberingProjection } from '../numbering/types'
import type { PictureProjection } from '../pictures/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Projects complete message blocks and the actual self-marker without stripping a prefix.
 * @param source - Once-read formatting aggregate with independent message table scopes.
 * @param entry - Exact original complete message range.
 * @param styles - Shared styles and character baselines.
 * @param numbering - Shared numbering graph including message-only lists.
 * @param pictures - Disposable part-local media scope.
 * @param context - Shared XML budget and loss-report owner.
 * @returns Complete rich message body with its final paragraph identity.
 */
export function projectCommentContent(source: ConversionSource, entry: DocCommentEntry, styles: StyleProjection,
  numbering: NumberingProjection, pictures: PictureProjection, context: ProjectionContext): DocxXmlElementPlan[] {
  const marker = source.storage.text.indexOf('\u0005', entry.start)
  const hasMarker = marker >= entry.start && marker < entry.end
  const next = hasMarker ? source.storage.text.indexOf('\u0005', marker + 1) : -1
  requireDoc(next < 0 || next >= entry.end, 'invalid-story-data', 'Comment body has ambiguous multiple self markers')
  if (!hasMarker) context.diagnose({ code: 'comment-self-marker-absent', kind: 'compatibility', source: `comment:${entry.index}`,
    start: entry.start, end: entry.end, message: 'The source message omits its optional producer self-marker; complete author text is retained without inventing a control.' })
  else if (!source.runs[findSourceInterval(source.runs, marker)]?.baseFormat.special) context.diagnose({
    code: 'comment-control-flag-missing', kind: 'compatibility', source: `comment:${entry.index}`, start: marker, end: marker + 1,
    message: 'The original comment self-marker lacks CFSpec; its validated message scope and unique control establish ownership.' })
  let seen = false
  const children = projectStoryBlocks(source, styles, context, entry, numbering, pictures, undefined, {
    handledRuns: new Set(),
    project(position, runIndex) {
      if (!hasMarker || position !== marker) return undefined
      seen = true
      this.handledRuns.add(runIndex)
      return context.element('annotationRef')
    },
  })
  requireDoc(!hasMarker || seen, 'invalid-story-data', 'Comment self-marker belongs to omitted field instruction data')
  if (hasMarker) context.diagnose({ code: 'comment-self-marker-presentation-host-limit', kind: 'host-limit', source: `comment:${entry.index}`,
    start: marker, end: marker + 1, message: 'The initial DOCX retains the exact annotationRef position; LitAST and Classic keep the complete author body but do not model legacy comment ordinal presentation in regenerated messages.' })
  // Modern parent joins address the last direct paragraph. A terminal table
  // receives a structural empty paragraph rather than borrowing a cell identity.
  if (children[children.length - 1]?.localName !== 'p') children.push(context.element('p'))
  const last = children.length - 1, paragraph = children[last]!
  children[last] = context.xml({ ...paragraph, attributes: [...paragraph.attributes, {
    namespaceUri: 'http://schemas.microsoft.com/office/word/2010/wordml', localName: 'paraId', prefix: 'w14',
    value: commentParagraphId(entry.index),
  }] })
  return children
}

/** @param index - Bounded original message slot. @returns Document-local deterministic modern paragraph identity. */
export function commentParagraphId(index: number): string { return (index + 1).toString(16).padStart(8, '0').toUpperCase() }
