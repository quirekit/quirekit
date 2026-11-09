import type { DocCommentEntry } from '../../word/comments/types'
import type { ProjectionContext } from '../xml/types'
import { readFloatingDttm } from '../../word/date-time'

/**
 * Interprets source minute-resolution calendar bits without inventing a timezone.
 * @param entry - Original optional DTTM and exact message ownership.
 * @param context - Explicit invalid-date loss reporter.
 * @returns Floating ISO carrier with zero seconds, or no date when absent/ignored/invalid.
 */
export function commentDate(entry: DocCommentEntry, context: ProjectionContext): string | undefined {
  const raw = entry.extra?.rawTimestamp
  if (raw === undefined) return undefined
  const date = readFloatingDttm(raw)
  if (date === null) {
    context.diagnose({ code: 'comment-date-unprojected', kind: 'loss', source: `comment:${entry.index}`, start: entry.start, end: entry.end,
      message: `Invalid source DTTM 0x${raw.toString(16)} is omitted; the message and its original raw timestamp remain independently inspectable.` })
    return undefined
  }
  return date
}
