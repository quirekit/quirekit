import { type DocReadError } from '../../errors'
import { readNoteRecords } from '../../word/notes/read'
import { readStoryFormatting } from '../source/story'
import { readStoryTables } from '../source/tables'
import { recoverStorySource } from '../source/policy'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import type { NoteInput } from './types'

/**
 * Reads each family once, sharing document work and isolating note table boundaries.
 * @param source - Validated main story and common source authorities.
 * @param context - Bounded loss-report owner.
 * @returns Validated directory and any successfully interpreted content aggregates.
 */
export function readNoteInput(source: ConversionSource, context: ProjectionContext): NoteInput {
  const contents = new Map<'footnote' | 'endnote', ConversionSource>()
  const refusals = new Map<number, DocReadError>()
  let entries
  try { entries = readNoteRecords(source.table, source.header, source.storage, source.limits).entries } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'note-directory-unprojected', kind: 'loss', source: 'notes',
      message: `Note membership is omitted (${error.code}: ${error.message}); no unverified references are installed.` })
    return { entries: [], contents, refusals }
  }
  for (const [kind, index] of [['footnote', 1], ['endnote', 4]] as const) {
    const notes = entries.filter(note => note.kind === kind)
    if (!notes.length) continue
    const story = source.header.stories[index]!
    try {
      const formatting = readStoryFormatting(source, story)
      contents.set(kind, readStoryTables(formatting, notes, refusals, context))
    } catch (error) {
      if (!recoverStorySource(error, context)) throw error
      context.diagnose({ code: 'note-source-unprojected', kind: 'loss', source: `story:${kind}`, start: story.start, end: story.end,
        message: `Note source formatting is unavailable (${error.code}: ${error.message}).` })
    }
  }
  return { entries, contents, refusals }
}
