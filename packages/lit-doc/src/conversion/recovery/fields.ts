import { DocReadError, requireDoc } from '../../errors'
import type { WordDocumentSource } from '../../word/document/types'
import { readFieldIndex } from '../../word/fields/read'
import type { DocFieldEntry } from '../../word/fields/types'
import type { ProjectionContext } from '../xml/types'
import type { TextRecoveryFieldFrame, TextRecoveryFields } from './types'

/** @param source - Validated source text and field PLC. @returns Entries whose cached-result ownership agrees with actual raw nesting. */
function readRecoveryFieldIndex(source: WordDocumentSource): Map<number, DocFieldEntry> {
  const story = source.storage.recoveredRange ?? source.header.stories[0]!
  const index = readFieldIndex(source.table, source.header, source.storage, story, source.limits, { remaining: source.limits.maxFields })
  const entries = new Map(index.entries.map(entry => [entry.start, entry]))
  const separators = new Map(index.entries.flatMap(entry => entry.separator === null ? [] : [[entry.separator, entry]]))
  const ends = new Map(index.entries.map(entry => [entry.end - 1, entry]))
  const frames: { start: number, separator: number | null }[] = []
  let count = 0
  // Validate complete raw/index agreement before exposing any cached result.
  // A later conflicting end must not reveal text already emitted by recovery.
  for (let position = story.start; position < story.end; position++) {
    const code = source.storage.text.charCodeAt(position - (source.storage.recoveredRange?.start ?? 0))
    if (code === 19) {
      requireDoc(++count <= source.limits.maxFields && frames.length < source.limits.maxFieldDepth,
        'limit-exceeded', 'Text recovery field count or nesting limit exceeded')
      frames.push({ start: position, separator: null })
    } else if (code === 20 || code === 21) {
      const frame = frames[frames.length - 1]
      requireDoc(frame, 'invalid-field-data', 'Recovered field control has no actual begin')
      const entry = entries.get(frame.start)
      if (code === 20) {
        requireDoc(frame.separator === null && (!entry || entry.separator === position)
          && (!separators.has(position) || separators.get(position) === entry),
        'invalid-field-data', 'Recovered field separator disagrees with actual indexed ownership')
        frame.separator = position
      } else {
        requireDoc((!entry || entry.end === position + 1) && (!ends.has(position) || ends.get(position) === entry),
          'invalid-field-data', 'Recovered field end disagrees with actual indexed ownership')
        frames.pop()
      }
    }
  }
  requireDoc(frames.length === 0, 'invalid-field-data', 'Recovered source field remains unclosed')
  return entries
}

/**
 * Keeps field instructions and private cached content outside recovered visible text.
 * @param source - Validated private source snapshot.
 * @param context - Existing output and diagnostic owner.
 * @returns Bounded source-order field state.
 */
export function createTextRecoveryFields(source: WordDocumentSource, context: ProjectionContext): TextRecoveryFields {
  const story = source.storage.recoveredRange ?? source.header.stories[0]!
  let indexed = new Map<number, DocFieldEntry>()
  let trusted = true
  try {
    indexed = readRecoveryFieldIndex(source)
  } catch (error) {
    if (!(error instanceof DocReadError) || error.code !== 'invalid-field-data') throw error
    trusted = false
    context.diagnose({ code: 'text-recovery-field-state-unreadable', kind: 'loss', source: 'field',
      message: 'Source field metadata could not be decoded. Field instructions and cached results are omitted during text recovery.' })
  }
  const frames: TextRecoveryFieldFrame[] = []
  let hidden = 0, count = 0, broken = false

  /** @param position - First ambiguous source CP whose tail has no reliable field ownership. */
  function omitTail(position: number): void {
    broken = true
    context.diagnose({ code: 'text-recovery-field-tail-omitted', kind: 'loss', source: 'field', start: position, end: story.end,
      message: 'Ambiguous field controls prevent identifying visible trailing content. The remaining main-story tail is omitted.' })
  }

  return {
    /** @returns Whether every active field ancestor admits ordinary cached text. */
    get visible() { return !broken && hidden === 0 },
    /** @param position - Absolute source CP. @param code - Actual field control. */
    control(position, code) {
      if (broken) return
      if (code === 19) {
        requireDoc(++count <= source.limits.maxFields && frames.length < source.limits.maxFieldDepth,
          'limit-exceeded', 'Text recovery field count or nesting limit exceeded')
        const entry = indexed.get(position)
        frames.push({ start: position, instruction: true, suppressResult: !trusted || entry?.flags.privateResult === true })
        hidden++
        if (entry?.flags.privateResult) context.diagnose({ code: 'text-recovery-private-result-omitted', kind: 'loss', source: 'field',
          start: position, end: entry.end, message: 'Private field instructions and cached results are omitted from the recovered visible body.' })
        return
      }
      const frame = frames[frames.length - 1]
      if (!frame || code === 20 && !frame.instruction) { omitTail(position); return }
      if (code === 20) {
        frame.instruction = false
        if (!frame.suppressResult) hidden--
      } else {
        if (frame.instruction || frame.suppressResult) hidden--
        frames.pop()
      }
    },
    /** Records an incomplete field using the original main-story boundary. */
    finish() {
      if (frames.length && !broken) context.diagnose({ code: 'text-recovery-field-unclosed', kind: 'loss', source: 'field',
        start: frames[0]!.start, end: story.end, message: 'A source field remains unclosed at the main-story boundary. Only already identified visible text is retained.' })
    },
  }
}
