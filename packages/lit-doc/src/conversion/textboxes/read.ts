import { readTextboxRecords } from '../../word/textboxes'
import type { ConversionSource } from '../source/types'
import { readStorySource } from '../source/story'
import { recoverStorySource } from '../source/policy'
import type { ProjectionContext } from '../xml/types'
import type { TextboxInput, TextboxInputPart } from './types'

/** @param source - Immutable original document with shared styles and budgets. @param context - Explicit source-loss owner. @returns Independent raw textbox directories and once-read content without emitting any drawing. */
export function readTextboxInput(source: ConversionSource, context: ProjectionContext): TextboxInput {
  const parts = new Map<string, TextboxInputPart>()
  if (!source.header.stories.slice(5).some(story => story.end > story.start)
    && ![56, 58, 75, 76].some(slot => source.header.records[slot]?.length)) return { parts }
  try {
    const directory = readTextboxRecords(source, source.context.reader)
    for (const part of directory.parts) {
      const story = source.header.stories[part.kind === 'textbox' ? 5 : 6]!
      // Source shape ownership is indexed once. A self-reference can be a
      // terminal single frame only when no second active chain claims its owner.
      const owners = new Map<number, number | null>()
      source.context.reader.consume(part.entries.length)
      for (const record of part.entries) if (!record.reusable)
        owners.set(record.shapeId, owners.has(record.shapeId) ? null : record.index)
      const entry: TextboxInputPart = { directory: part, owners, content: null }; parts.set(part.kind, entry)
      if (!part.entries.some(value => !value.reusable)) continue
      try { entry.content = readStorySource(source, story) } catch (error) {
        if (!recoverStorySource(error, context)) throw error
        context.diagnose({ code: 'textbox-source-unprojected', kind: 'loss', source: `story:${part.kind}`,
          start: story.start, end: story.end, message: `Textbox formatting is unavailable (${error.code}: ${error.message}).` })
      }
    }
  } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'textbox-directory-unprojected', kind: 'loss', source: 'textbox',
      message: `Textbox source directory is unavailable (${error.code}: ${error.message}).` })
  }
  return { parts }
}
