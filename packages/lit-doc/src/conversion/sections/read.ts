import type { WordSectionRecord } from '../../word/sections/types'
import type { NoteSettingsProjection } from '../notes/settings/types'
import type { ProjectionContext } from '../xml/types'
import { sectionProperties } from './properties'
import type { ProjectedSection } from './types'

/**
 * Reads each SED's own SEPX rather than inheriting the preceding section's page tuple.
 * @param sections - Once-read independent section authorities.
 * @param context - Projection output and loss-report owner.
 * @param notes - Successfully projected note settings.
 * @returns Ordered main-story sections with independent page settings.
 */
export function projectSections(sections: readonly WordSectionRecord[], context: ProjectionContext,
  notes: NoteSettingsProjection): readonly ProjectedSection[] {
  context.report.source.sections = sections.length
  return sections.map((section, index) => {
    const noteProperties = notes.sections.get(index)
    const operations = section.operations.filter(operation => !noteProperties?.handled.has(operation.opcode))
    return { start: section.start, end: section.end,
      properties: sectionProperties(operations, context, `section:${index}`, noteProperties) }
  })
}
