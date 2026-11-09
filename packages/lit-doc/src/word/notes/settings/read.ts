import type { WordDocumentSource } from '../../document/types'
import type { PropertyReader } from '../../properties/types'
import { readSectionRecords } from '../../sections/read'
import { readNoteDocumentSettings } from './document'
import { readNoteSectionSettings } from './section'
import type { DocNoteSettingsSource } from './types'

/**
 * Inspects numbering and placement separately from optional note text directories.
 * @param source - Validated storage snapshot and limits.
 * @param reader - Shared source operation budget.
 * @returns Original document rules and independent section rules.
 */
export function readNoteSettings(source: WordDocumentSource, reader: PropertyReader): DocNoteSettingsSource {
  return { scope: 'note-settings-source', document: readNoteDocumentSettings(source.table, source.header),
    sections: readSectionRecords(source, reader).map(readNoteSectionSettings) }
}
