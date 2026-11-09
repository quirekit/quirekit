import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { DocReadError } from '../../../errors'
import type { WordDocumentSource } from '../../../word/document/types'
import type { DocNoteRange } from '../../../word/notes/types'
import { readNoteDocumentSettings } from '../../../word/notes/settings/document'
import { readNoteSectionSettings } from '../../../word/notes/settings/section'
import type { WordSectionRecord } from '../../../word/sections/types'
import { recoverStorySource } from '../../source/policy'
import type { ProjectionContext } from '../../xml/types'
import type { NotePropertyValues, NoteSectionProjection, NoteSettingsProjection } from './types'
import { documentNoteValues, sectionNoteValues } from './values'

/**
 * Preserves document rules and independent section overrides without choosing a native note renderer.
 * @param source - Original storage and effective version.
 * @param sectionRecords - Once-read, shared-budget section operations.
 * @param entries - Validated source note families.
 * @param context - Shared XML budget and explicit loss policy.
 * @returns Successful note settings alongside bounded, located failure diagnostics.
 */
export function projectNoteSettings(source: WordDocumentSource, sectionRecords: readonly WordSectionRecord[],
  entries: readonly DocNoteRange[], context: ProjectionContext): NoteSettingsProjection {
  const sections = new Map<number, NoteSectionProjection>()
  const result: NoteSettingsProjection = { documentProperties: [], sections }
  const kinds = (['footnote', 'endnote'] as const).filter(kind => entries.some(note => note.kind === kind && note.autoNumbered))
  if (!kinds.length) return result
  let document
  try { document = readNoteDocumentSettings(source.table, source.header) } catch (error) {
    refuse(error, 'document:notes', context)
    return result
  }
  if (!document) context.diagnose({ code: 'note-document-settings-missing', kind: 'approximation', source: 'document:notes',
    message: 'The source has no DOP note settings; output uses explicit Word defaults until document settings are available.' })
  // Document rules use the effective source version. Their separator references
  // are installed later only when main-body projection retains the note part.
  for (const kind of kinds) {
    try {
      const values = documentNoteValues(kind, document?.legacyNumbering?.[kind], document?.endnotePosition ?? 3)
      const property = notePropertyXml(kind, values, context)
      result.documentProperties.push({ ...property, children: [...property.children,
        context.element(kind, { id: -1 }), context.element(kind, { id: 0 })] })
      reportHostLimit(kind, values, `document:${kind}`, context)
    } catch (error) { refuse(error, `document:${kind}`, context) }
  }
  // Each SEPX starts from its own defaults. A rule's operations become handled
  // only after its complete OOXML override has been constructed successfully.
  for (const [index, record] of sectionRecords.entries()) {
    let settings
    try { settings = readNoteSectionSettings(record) } catch (error) {
      refuse(error, `section:${index}:notes`, context)
      continue
    }
    const projected: NoteSectionProjection = { elements: [], handled: new Set() }
    if (kinds.includes('endnote') && settings.suppressEndnotes !== undefined) {
      projected.suppressEndnotes = settings.suppressEndnotes
      projected.handled.add(0x3012)
      if (settings.suppressEndnotes) context.diagnose({ code: 'note-settings-host-limit', kind: 'host-limit', source: `section:${index}:endnote`,
        message: 'Section-end endnote suppression is preserved in OOXML; native Classic note placement requires further support.' })
    }
    if (source.header.version > 0xd9) for (const kind of kinds) {
      const location = `section:${index}:${kind}`
      try {
        const values = sectionNoteValues(settings[kind], location, context)
        if (Object.keys(values).length) {
          projected.elements.push(notePropertyXml(kind, values, context))
          reportHostLimit(kind, values, location, context)
        }
        const opcodes = kind === 'footnote' ? [0x303b, 0x303c, 0x503f, 0x5040] : [0x303e, 0x5041, 0x5042]
        for (const operation of record.operations) if (opcodes.includes(operation.opcode)) projected.handled.add(operation.opcode)
      } catch (error) { refuse(error, location, context) }
    }
    sections.set(index, projected)
  }
  return result
}

/** @param kind - Note family. @param values - Admitted property values. @param context - XML budget owner. @returns Schema-ordered property group. */
function notePropertyXml(kind: string, values: NotePropertyValues, context: ProjectionContext): DocxXmlElementPlan {
  const names = ['pos', 'numFmt', 'numStart', 'numRestart'] as const
  return context.element(`${kind}Pr`, {}, names.flatMap(name => values[name] === undefined ? [] : [context.element(name, { val: values[name] })]))
}

/** @param kind - Family. @param values - Actual output. @param source - Located authority. @param context - Diagnostic owner. */
function reportHostLimit(kind: 'footnote' | 'endnote', values: NotePropertyValues, source: string, context: ProjectionContext): void {
  const defaults: NotePropertyValues = { numFmt: kind === 'footnote' ? 'decimal' : 'lowerRoman', numStart: 1,
    numRestart: 'continuous', pos: kind === 'footnote' ? 'pageBottom' : 'docEnd' }
  if (Object.entries(values).some(([field, value]) => value !== defaults[field as keyof NotePropertyValues])) context.diagnose({
    code: 'note-settings-host-limit', kind: 'host-limit', source,
    message: 'Source note numbering or placement is preserved in OOXML; native Classic display currently uses default continuous markers and placement.' })
}

/** @param error - Source or mapping refusal. @param source - Located rule. @param context - Explicit loss policy. */
function refuse(error: unknown, source: string, context: ProjectionContext): void {
  if (!recoverStorySource(error, context) && !(error instanceof DocReadError && error.code === 'unsupported-numbering'
    && context.report.lossPolicy === 'best-effort')) throw error
  context.diagnose({ code: 'note-settings-unprojected', kind: 'loss', source,
    message: `Note settings are omitted (${error.code}: ${error.message}); validated note content remains independently connected.` })
}
