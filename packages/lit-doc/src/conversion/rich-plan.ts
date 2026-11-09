import { projectSourceDiagnostics } from './source/diagnostics'
import { finishDocumentBookmarks } from './bookmarks/complete'
import { projectHeaderFooters, readHeaderFooterInput } from './header-footer'
import { projectNotes, readNoteInput } from './notes'
import { projectComments, readCommentInput } from './comments'
import { projectNoteSettings } from './notes/settings/project'
import { readSectionRecords } from '../word/sections/read'
import { officeRelationships, wordPart } from './xml/parts'
import { projectDocument } from './body/document'
import { DocConversionError } from './errors'
import { projectNumbering } from './numbering'
import { createPictureProjection } from './pictures'
import { projectSections } from './sections/read'
import { projectFontTable } from './styles/fonts'
import { projectStyles } from './styles/project'
import type { DocSourcePlanResult } from './types'
import type { ConversionSource } from './source/types'
import type { ProjectionContext } from './xml/types'
import { readTextboxInput } from './textboxes/read'
import { createTextboxProjection } from './textboxes/projection'
import { projectDefaultTabInterval } from './settings/tabs'

/**
 * Projects legacy DOC into the existing typed OOXML package contract without a ZIP or platform dependency.
 * @param source - Complete validated rich source snapshot.
 * @param context - Document-owned output budget and loss policy.
 * @returns Complete unresolved package graph and source projection report.
 */
export function projectRichDocxSource(source: ConversionSource, context: ProjectionContext): DocSourcePlanResult {
  projectSourceDiagnostics([...source.container.diagnostics, ...source.header.diagnostics], context)
  for (const story of source.header.stories.slice(1)) if (!['header', 'footnote', 'endnote', 'comment', 'textbox', 'headerTextbox'].includes(story.kind) && story.end > story.start) context.diagnose({ code: 'story-unprojected', kind: 'loss', source: `story:${story.kind}`,
    start: story.start, end: story.end, message: 'This non-main story and its document references are not yet projected.' })
  if (source.header.records[31]?.length) context.diagnose({ code: 'document-settings-unprojected', kind: 'loss', source: 'document',
    message: 'DOP compatibility, editing and layout settings beyond implemented header, note and default-tab settings require further projection; source paragraph and section values remain independent.' })
  if (source.header.records[50]?.length) context.diagnose({ code: 'drawing-globals-unprojected', kind: 'loss', source: 'document',
    message: 'Global drawing records beyond admitted picture resources/defaults and ordinary placement require additional projection; inline pictures retain their local source properties.' })
  for (const [field, name] of [[24, 'command strings']] as const)
    if (source.header.records[field]?.length) context.diagnose({ code: 'document-index-unprojected', kind: 'loss', source: `fib:${field}`,
      message: `Source ${name} metadata is not yet projected.` })
  const headerInput = readHeaderFooterInput(source, context)
  const noteInput = readNoteInput(source, context)
  const commentInput = readCommentInput(source, context)
  const textboxInput = readTextboxInput(source, context)
  const fonts = projectFontTable(source.fonts, context)
  const numbering = projectNumbering(source, context, [...(headerInput.content ? [headerInput.content] : []), ...noteInput.contents.values(),
    ...(commentInput.content ? [commentInput.content] : []), ...[...textboxInput.parts.values()].flatMap(part => part.content ? [part.content] : [])])
  const styles = projectStyles(source, context, numbering)
  const textboxes = createTextboxProjection(textboxInput, styles, numbering, context)
  const pictures = createPictureProjection(source, context, textboxes)
  const headers = projectHeaderFooters(headerInput, styles, numbering, pictures, context)
  const notes = projectNotes(source, noteInput, styles, numbering, pictures, context)
  const comments = projectComments(source, commentInput, styles, numbering, pictures, context)
  const sectionRecords = readSectionRecords(source, source.context.reader)
  const noteSettings = projectNoteSettings(source, sectionRecords, noteInput.entries, context)
  const sections = projectSections(sectionRecords, context, noteSettings).map((section, index) => ({ ...section,
    properties: { ...section.properties, children: [...(headers.references.get(index) ?? []), ...section.properties.children] } }))
  const document = comments.finish(projectDocument(source, styles, sections, context, numbering, pictures, notes, comments))
  notes.finish()
  textboxes.finish()
  finishDocumentBookmarks(source, context)
  const parts = [wordPart('/word/document.xml', 'document.main', document), wordPart('/word/styles.xml', 'styles', styles.root), wordPart('/word/fontTable.xml', 'fontTable', fonts), ...headers.parts, ...notes.parts, ...comments.parts]
  const resources = [...new Map([...pictures.resources, ...headers.resources, ...notes.resources, ...comments.resources].map(resource => [resource.key, resource])).values()]
  const plan = { resources, parts, relationships: [
    { key: 'document', sourcePart: '/', relationshipType: `${officeRelationships}officeDocument`, target: '/word/document.xml', targetMode: 'internal' as const },
    ...['styles', 'fontTable'].map(name => ({ key: name, sourcePart: '/word/document.xml', relationshipType: `${officeRelationships}${name}`, target: `/word/${name}.xml`, targetMode: 'internal' as const })),
    ...pictures.relationships, ...headers.relationships, ...notes.relationships, ...comments.relationships,
  ] }
  const parity = headerInput.directory?.evenAndOddHeaders
  const activeNoteSettings = noteSettings.documentProperties.filter(properties => {
    const path = properties.localName === 'footnotePr' ? '/word/footnotes.xml' : '/word/endnotes.xml'
    return notes.parts.some(part => part.name === path)
  })
  const settings = [...(parity === undefined || parity === null ? [] : [context.element('evenAndOddHeaders', { val: parity ? '1' : '0' })]),
    ...[projectDefaultTabInterval(source, context)].filter((value): value is NonNullable<typeof value> => value !== undefined), ...activeNoteSettings]
  if (settings.length) {
    parts.push(wordPart('/word/settings.xml', 'settings', context.element('settings', {}, settings)))
    plan.relationships.push({ key: 'settings', sourcePart: '/word/document.xml', relationshipType: `${officeRelationships}settings`,
      target: '/word/settings.xml', targetMode: 'internal' })
  }
  if (numbering.root) {
    parts.push(wordPart('/word/numbering.xml', 'numbering', numbering.root))
    plan.relationships.push({ key: 'numbering', sourcePart: '/word/document.xml', relationshipType: `${officeRelationships}numbering`,
      target: '/word/numbering.xml', targetMode: 'internal' })
  }
  for (const diagnostic of source.context.diagnostics) context.diagnose({ ...diagnostic,
    kind: ['property-tail-omitted', 'indirect-property-omitted', 'paragraph-properties-defaulted'].includes(diagnostic.code) ? 'loss' : 'compatibility',
    source: diagnostic.code.startsWith('cfb-') ? 'container'
      : ['property-tail-omitted', 'indirect-property-omitted', 'indirect-property-compatibility', 'paragraph-properties-defaulted',
        'table-definition-length-compatibility'].includes(diagnostic.code) ? 'properties'
      : diagnostic.code === 'bookmark-equivalent-end-index' ? 'bookmarks'
      : ['implicit-table-depth', 'redundant-nested-table-frame'].includes(diagnostic.code) ? 'tables'
      : ['terminal-character-format-absent', 'implicit-rtl-style-inversion', 'legacy-zero-font-size'].includes(diagnostic.code) ? 'characters' : 'styles' })
  if (context.report.lossPolicy === 'strict' && context.report.lossy) throw new DocConversionError(context.report)
  return { plan, report: context.report }
}
