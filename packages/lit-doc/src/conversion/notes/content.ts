import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { DocNoteRange } from '../../word/notes/types'
import { projectStoryBlocks } from '../body/story'
import type { ConversionSource } from '../source/types'
import { findSourceInterval } from '../source/lookup'
import type { StyleProjection } from '../styles/types'
import type { NumberingProjection } from '../numbering/types'
import type { PictureProjection } from '../pictures/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Projects complete author blocks while retaining the exact source self-marker position.
 * @param source - Once-read family aggregate with canonical paragraph/table indexes.
 * @param note - Complete ordinary note range including its final CR.
 * @param styles - Shared named styles.
 * @param numbering - Shared numbering definitions.
 * @param pictures - Disposable note-local media registration.
 * @param context - Shared XML budget and loss-report owner.
 * @returns Complete ordinary note children with a unique self marker.
 */
export function projectNoteContent(source: ConversionSource, note: DocNoteRange, styles: StyleProjection,
  numbering: NumberingProjection, pictures: PictureProjection, context: ProjectionContext): DocxXmlElementPlan[] {
  const marker = source.storage.text.indexOf('\u0002', note.start)
  const next = marker < 0 ? -1 : source.storage.text.indexOf('\u0002', marker + 1)
  requireDoc(marker >= note.start && marker < note.end && (next < 0 || next >= note.end),
    'invalid-story-data', 'Automatic note requires one unambiguous source self marker')
  const runIndex = findSourceInterval(source.runs, marker)
  requireDoc(source.runs[runIndex]?.baseFormat.special, 'invalid-story-data', 'Note self marker is missing CFSpec')
  if (marker !== note.start) context.diagnose({ code: 'note-self-marker-position-host-limit', kind: 'host-limit', source: `note:${note.kind}:${note.index}`,
    start: marker, end: marker + 1, message: 'The DOCX retains the source self-marker position; LitAST and Classic derive the marker before the first paragraph.' })
  let seen = false
  const handledRuns = new Set<number>()
  const children = projectStoryBlocks(source, styles, context, note, numbering, pictures, {
    handledRuns,
    project(position, index) {
      if (position !== marker) return undefined
      seen = true
      handledRuns.add(index)
      return context.element(`${note.kind}Ref`)
    },
  })
  requireDoc(seen, 'invalid-story-data', 'Note self marker was hidden inside an omitted field instruction')
  return children
}
