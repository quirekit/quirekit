import type { DocLegacyNoteRule, DocNoteSectionRule } from '../../../word/notes/settings/types'
import { numberingFormat } from '../../numbering/format'
import type { ProjectionContext } from '../../xml/types'
import type { NotePropertyValues } from './types'

const restarts = ['continuous', 'eachSect', 'eachPage'] as const
const footnotePositions = ['sectEnd', 'pageBottom', 'beneathText'] as const

/**
 * Maps a complete document rule to explicit interoperable OOXML values.
 * @param kind - Note family.
 * @param rule - Active old-version numbering, absent for modern section-owned defaults.
 * @param endnotePosition - Active DOP position, or the documented fallback when unavailable.
 * @returns Fully specified document-wide rule.
 */
export function documentNoteValues(kind: 'footnote' | 'endnote', rule: DocLegacyNoteRule | undefined,
  endnotePosition: number): NotePropertyValues {
  return { pos: kind === 'footnote' ? footnotePositions[rule?.position ?? 1]! : endnotePosition === 0 ? 'sectEnd' : 'docEnd',
    numFmt: numberingFormat(rule?.format ?? (kind === 'footnote' ? 0 : 2), 'note'),
    numStart: rule?.start ?? 1, numRestart: restarts[rule?.restart ?? 0]! }
}

/**
 * Maps only explicit section fields, retaining the distinction between absent and zero offsets.
 * @param rule - Independent original section note rule.
 * @param source - Located section/family authority for diagnostics.
 * @param context - Bounded diagnostic owner.
 * @returns Actual overrides, with protocol-ignored offsets excluded.
 */
export function sectionNoteValues(rule: DocNoteSectionRule, source: string, context: ProjectionContext): NotePropertyValues {
  const result: NotePropertyValues = {}
  for (const field of rule.explicit) {
    if (field === 'format') result.numFmt = numberingFormat(rule.format, 'note')
    else if (field === 'position') result.pos = footnotePositions[rule.position!]!
    else if (field === 'restart') result.numRestart = restarts[rule.restart]!
    else if (rule.restart === 0) result.numStart = rule.offset
    else context.diagnose({ code: 'ignored-note-offset', kind: 'compatibility', source,
      message: 'The source continuous-numbering offset is ignored because this section restarts its note numbering.' })
  }
  return result
}
