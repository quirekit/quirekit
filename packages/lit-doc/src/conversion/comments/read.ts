import { type DocReadError } from '../../errors'
import { readCommentRecords } from '../../word/comments/read'
import { recoverStorySource } from '../source/policy'
import { readStoryFormatting } from '../source/story'
import { readStoryTables } from '../source/tables'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import type { CommentInput } from './types'

/**
 * Resolves original comment membership and aggregate formatting once with shared budgets.
 * @param source - Complete main Story and document-wide source authorities.
 * @param context - Explicit best-effort/strict loss policy.
 * @returns Original message intervals and any successfully read body authorities.
 */
export function readCommentInput(source: ConversionSource, context: ProjectionContext): CommentInput {
  const refusals = new Map<number, DocReadError>()
  let entries
  try { entries = readCommentRecords(source.table, source.header, source.storage, source.limits).entries } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'comment-directory-unprojected', kind: 'loss', source: 'comments',
      message: `Comment membership is omitted (${error.code}: ${error.message}); no unverified references or entries are installed.` })
    return { entries: [], refusals }
  }
  if (!entries.length) return { entries, refusals }
  const story = source.header.stories[3]!
  try {
    const formatting = readStoryFormatting(source, story)
    return { entries, refusals, content: readStoryTables(formatting, entries, refusals, context) }
  } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'comment-source-unprojected', kind: 'loss', source: 'story:comment', start: story.start, end: story.end,
      message: `Comment source formatting is unavailable (${error.code}: ${error.message}); its message threads are omitted.` })
    return { entries, refusals }
  }
}
