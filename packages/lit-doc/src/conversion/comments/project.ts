import { requireDoc } from '../../errors'
import type { ConversionSource } from '../source/types'
import { findSourceInterval } from '../source/lookup'
import { recoverStorySource } from '../source/policy'
import type { StyleProjection } from '../styles/types'
import type { NumberingProjection } from '../numbering/types'
import type { PictureDocumentProjection } from '../pictures/types'
import type { ProjectionContext } from '../xml/types'
import { projectCommentContent } from './content'
import { commentDate } from './date'
import { installCommentParts } from './parts'
import { commentRanges, omitCommentThreads } from './ranges'
import { commentThreadRoots } from './threads'
import type { CommentInput, CommentProjection, PendingCommentOutput } from './types'

/**
 * Stages complete rich messages and admits references, ranges and parent graphs atomically.
 * @param source - Main source runs and immutable original storage.
 * @param input - Validated original membership and shared body formatting.
 * @param styles - Shared source style graph.
 * @param numbering - Document numbering including message paragraphs.
 * @param pictures - Shared decoding budgets with disposable per-message registration.
 * @param context - Bounded output and explicit loss policy.
 * @returns Exact main control/range owner and one-shot final package installation.
 */
export function projectComments(source: ConversionSource, input: CommentInput, styles: StyleProjection, numbering: NumberingProjection,
  pictures: PictureDocumentProjection, context: ProjectionContext): CommentProjection {
  const pending = new Map<number, PendingCommentOutput>(), failed = new Set<number>(), roots = commentThreadRoots(input.entries)
  const e = context.element
  for (const entry of input.entries) {
    const content = input.content, media = content ? pictures.forStory(content, '/word/comments.xml') : undefined
    try {
      const refusal = input.refusals.get(entry.start)
      if (refusal) throw refusal
      requireDoc(content && media, 'invalid-story-data', 'Comment body source is unavailable')
      const children = projectCommentContent(content, entry, styles, numbering, media, context)
      const date = commentDate(entry, context)
      pending.set(entry.index, { source: entry, media, referenced: false, boundaries: 0,
        element: e('comment', { id: entry.index, author: entry.author, initials: entry.initials, ...(date ? { date } : {}) }, children) })
      if (entry.extra?.ink) context.diagnose({ code: 'comment-ink-unprojected', kind: 'loss', source: `comment:${entry.index}`, start: entry.start, end: entry.end,
        message: 'The original message is an ink annotation; ordinary message content is retained, while ink-specific data and editing require their own owner.' })
    } catch (error) {
      if (!recoverStorySource(error, context)) throw error
      failed.add(entry.index)
      context.diagnose({ code: 'comment-content-unprojected', kind: 'loss', source: `comment:${entry.index}`, start: entry.start, end: entry.end,
        message: `The complete thread is omitted after a message-body refusal (${error.code}: ${error.message}); no partial message or resources are installed.` })
    }
  }
  const byAnchor = new Map([...pending.values()].map(output => [output.source.anchor, output]))
  const result: CommentProjection = { parts: [], relationships: [], resources: [], handledRuns: new Set(),
    boundaries: commentRanges(input.entries, pending, failed, source.storage.text, context),
    project(position, runIndex, inField) {
      const output = byAnchor.get(position)
      if (!output) return undefined
      if (inField) { failed.add(output.source.index); return undefined }
      requireDoc(!output.referenced, 'invalid-story-data', 'A comment reference was projected twice')
      if (!source.runs[findSourceInterval(source.runs, position)]?.baseFormat.special) context.diagnose({
        code: 'comment-control-flag-missing', kind: 'compatibility', source: `comment:${output.source.index}`, start: position, end: position + 1,
        message: 'The source reference lacks CFSpec; its validated directory and actual U+0005 establish comment ownership.' })
      output.referenced = true
      result.handledRuns.add(runIndex)
      if (output.source.extra?.parentIndex !== null && output.source.extra?.parentIndex !== undefined) {
        context.diagnose({ code: 'comment-reply-target-unprojected', kind: 'loss', source: `comment:${output.source.index}`,
          start: output.source.range?.start ?? position, end: output.source.range?.end ?? position + 1,
          message: 'The reply body and original parent are retained; its separate legacy quotation/reference is omitted because the native comment owner anchors the whole thread at its root.' })
        return null
      }
      return e('commentReference', { id: output.source.index })
    },
    finish(document) {
      for (const output of pending.values()) if (!output.referenced || output.boundaries !== (output.source.range ? 2 : 0)) failed.add(output.source.index)
      const omittedRoots = new Set([...failed].map(index => roots[index]!))
      const omitted = new Set(input.entries.filter(entry => omittedRoots.has(roots[entry.index]!)).map(entry => String(entry.index)))
      for (const index of omittedRoots) {
        const entry = input.entries[index]!
        context.diagnose({ code: 'comment-thread-unprojected', kind: 'loss', source: `comment:${index}`, start: entry.anchor, end: entry.anchor + 1,
          message: 'A message body, main reference or range endpoint has no admitted displayed carrier, including field-owned or row-only content; all entries, markers and resources of this thread are omitted.' })
      }
      installCommentParts([...pending.values()].filter(output => !omitted.has(String(output.source.index))), result, context)
      return omitted.size ? omitCommentThreads(document, omitted) : document
    },
  }
  return result
}
