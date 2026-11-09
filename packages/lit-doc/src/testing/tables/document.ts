import { compoundFixture } from '../compound'
import { withCharacterRecords } from '../characters'
import { operation, withStyleDefinitions } from '../formatting'
import { withParagraphRecords } from '../paragraphs'
import { wordStreams } from '../word'
import { conversionRecords } from '../conversion'
import { tableDefinition } from './definition'
import type { TableDocumentOptions, TableFixtureRow } from './types'

/**
 * Builds a real CFB/FIB/CLX/PAPX/CHPX fixture without serializing candidate output into its input.
 * @param rows - Explicit normative source rows; continuation content is retained verbatim.
 * @param options - Independent FIB and table-membership variations.
 * @returns Complete DOC bytes, with a normal paragraph after the table.
 */
export function tableDocument(rows: readonly TableFixtureRow[], options: TableDocumentOptions = {}): Uint8Array {
  const member = [...operation(0x2416, 1), ...(options.implicitDepth ? [] : operation(0x6649, 1, 0, 0, 0))]
  const paragraphs = rows.flatMap(row => [
    ...row.texts.map(text => ({ text: `${text}\u0007`, properties: member })),
    { text: '\u0007', properties: [...member, ...operation(0x2417, 1), ...tableDefinition(row.edges, row.cells), ...(row.properties ?? [])] },
  ])
  paragraphs.push({ text: '\r', properties: [] })
  const units = paragraphs.flatMap(paragraph => Array.from({ length: paragraph.text.length }, (_, index) => paragraph.text.charCodeAt(index)))
  let byte = 2048
  const pages = paragraphs.map(paragraph => {
    const start = byte; byte += paragraph.text.length * 2
    return { cuts: [start, byte], records: [{ bytes: paragraph.properties, odd: paragraph.properties.length % 2 === 1 }] }
  })
  const streams = withStyleDefinitions(withCharacterRecords(withParagraphRecords(wordStreams([{ units, unicode: true }],
    options.version === undefined ? {} : { version: options.version }), pages),
    [{ cuts: [2048, 2048 + units.length * 2] }]), [{ index: 0 }])
  return compoundFixture(conversionRecords(streams, units.length))
}
