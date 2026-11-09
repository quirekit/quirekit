import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { WordSectionRecord } from '../../sections/types'
import type { DocNoteSectionField, DocNoteSectionSettings } from './types'

const fields = new Map<number, readonly ['footnote' | 'endnote', DocNoteSectionField]>([
  [0x303b, ['footnote', 'position']], [0x303c, ['footnote', 'restart']], [0x303e, ['endnote', 'restart']],
  [0x503f, ['footnote', 'offset']], [0x5040, ['footnote', 'format']],
  [0x5041, ['endnote', 'offset']], [0x5042, ['endnote', 'format']],
])

/**
 * Applies ordered note modifiers to one independent section's normative defaults.
 * @param section - Source interval and validated SEPX operations.
 * @returns Source values plus actual presence, preserving explicit zero.
 */
export function readNoteSectionSettings(section: WordSectionRecord): DocNoteSectionSettings {
  const explicit = { footnote: new Set<DocNoteSectionField>(), endnote: new Set<DocNoteSectionField>() }
  const result: DocNoteSectionSettings = { start: section.start, end: section.end,
    footnote: { format: 0, restart: 0, offset: 0, position: 1, explicit: [] },
    endnote: { format: 2, restart: 0, offset: 0, explicit: [] } }
  for (const operation of section.operations) {
    if (operation.opcode === 0x3012) {
      const value = new ByteView(operation.operand, 'invalid-formatting-data').u8(0)
      requireDoc(value <= 1, 'invalid-formatting-data', 'Invalid section endnote display Boolean')
      result.suppressEndnotes = value === 0
      continue
    }
    const field = fields.get(operation.opcode)
    if (!field) continue
    const [kind, name] = field
    const source = new ByteView(operation.operand, 'invalid-formatting-data')
    const value = name === 'format' || name === 'offset' ? source.u16(0) : source.u8(0)
    requireDoc(name !== 'position' || value === 1 || value === 2, 'invalid-formatting-data', 'Invalid section footnote position')
    requireDoc(name !== 'restart' || value <= (kind === 'footnote' ? 2 : 1), 'invalid-formatting-data', 'Invalid section note restart selector')
    requireDoc(name !== 'offset' || value <= 16383, 'invalid-formatting-data', 'Invalid section note offset')
    result[kind][name] = value
    explicit[kind].add(name)
  }
  result.footnote.explicit = [...explicit.footnote]
  result.endnote.explicit = [...explicit.endnote]
  return result
}
