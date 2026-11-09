import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { NumberingProjection } from '../numbering/types'
import type { PictureDocumentProjection } from '../pictures/types'
import { findSourceInterval } from '../source/lookup'
import { recoverStorySource } from '../source/policy'
import type { ConversionSource } from '../source/types'
import type { StyleProjection } from '../styles/types'
import { officeRelationships, wordPart } from '../xml/parts'
import type { ProjectionContext } from '../xml/types'
import { projectNoteContent } from './content'
import type { NoteInput, NoteProjection, PendingNoteOutput } from './types'

/**
 * Stages note content, then commits only identities referenced by the displayed main story.
 * @param source - Canonical main story and reference-run authority.
 * @param input - Validated source note membership and content arrays.
 * @param styles - Shared named styles.
 * @param numbering - Shared numbering graph.
 * @param pictures - Shared decoding and occurrence budgets.
 * @param context - Bounded output and explicit loss policy.
 * @returns Reference projector with an atomic finalization step.
 */
export function projectNotes(source: ConversionSource, input: NoteInput, styles: StyleProjection, numbering: NumberingProjection,
  pictures: PictureDocumentProjection, context: ProjectionContext): NoteProjection {
  const pending = new Map<number, PendingNoteOutput>()
  const e = context.element
  for (const note of input.entries) {
    const location = { source: `note:${note.kind}:${note.index}`, start: note.anchor, end: note.anchor + 1 }
    if (!note.autoNumbered) {
      context.diagnose({ ...location, code: 'note-custom-marker-unprojected', kind: 'loss',
        message: 'Custom note references require their own marker contract; the source main-story character remains author text.' })
      continue
    }
    const anchorRun = source.runs[findSourceInterval(source.runs, note.anchor)]
    if (!anchorRun?.baseFormat.special) {
      context.diagnose({ ...location, code: 'note-reference-unprojected', kind: 'loss',
        message: 'The automatic reference lacks CFSpec and cannot establish an editable note identity.' })
      continue
    }
    const content = input.contents.get(note.kind)
    const media = content ? pictures.forStory(content, `/word/${note.kind}s.xml`) : undefined
    let children: DocxXmlElementPlan[]
    let successful = false
    try {
      const refusal = input.refusals.get(note.start)
      if (refusal) throw refusal
      requireDoc(content && media, 'invalid-story-data', 'Note content source is unavailable')
      children = projectNoteContent(content, note, styles, numbering, media, context)
      successful = true
    } catch (error) {
      if (!recoverStorySource(error, context)) throw error
      context.diagnose({ code: 'note-content-unprojected', kind: 'loss', source: location.source, start: note.start, end: note.end,
        message: `An explicit blank note replaces refused content (${error.code}: ${error.message}); its verified reference remains connected.` })
      children = [e('p', {}, [e('r', {}, [e(`${note.kind}Ref`)])])]
    }
    pending.set(note.anchor, { source: note, referenced: false,
      element: e(note.kind, { id: note.index + 1 }, children), ...(successful && media ? { media } : {}) })
  }

  const result: NoteProjection = { parts: [], relationships: [], resources: [], handledRuns: new Set(),
    project(position, runIndex) {
      const output = pending.get(position)
      if (!output) return undefined
      requireDoc(!output.referenced, 'invalid-story-data', 'A note reference was projected twice')
      output.referenced = true
      result.handledRuns.add(runIndex)
      return e(`${output.source.kind}Reference`, { id: output.source.index + 1 })
    },
    finish() {
      for (const output of pending.values()) if (!output.referenced) context.diagnose({
        code: 'note-reference-unprojected', kind: 'loss', source: `note:${output.source.kind}:${output.source.index}`,
        start: output.source.anchor, end: output.source.anchor + 1,
        message: 'The source reference belongs to omitted main-story content; its note part entry is omitted as well.' })
      for (const kind of ['footnote', 'endnote'] as const) {
        const notes = [...pending.values()].filter(output => output.referenced && output.source.kind === kind)
        if (!notes.length) continue
        const name = `/word/${kind}s.xml`
        const separators = ['separator', 'continuationSeparator'].map((type, index) =>
          e(kind, { id: index - 1, type }, [e('p', {}, [e('r', {}, [e(type)])])]))
        result.parts.push(wordPart(name, `${kind}s`, e(`${kind}s`, {}, [...separators, ...notes.map(note => note.element)])))
        result.relationships.push({ key: `${kind}s`, sourcePart: '/word/document.xml', relationshipType: `${officeRelationships}${kind}s`,
          target: name, targetMode: 'internal' })
        for (const note of notes) if (note.media) {
          result.relationships.push(...note.media.relationships)
          result.resources.push(...note.media.resources)
          if (note.media.relationships.length) context.diagnose({ code: 'note-resources-host-limit', kind: 'host-limit', source: `note:${kind}:${note.source.index}`,
            start: note.source.start, end: note.source.end,
            message: 'The DOCX contains part-local note media; regenerating edited LitAST note resources requires further writer support.' })
        }
        context.diagnose({ code: 'note-separators-approximated', kind: 'approximation', source: `story:${kind}`,
          message: 'Source separator stories require further projection; this output uses standard note separators.' })
      }
    },
  }
  return result
}
