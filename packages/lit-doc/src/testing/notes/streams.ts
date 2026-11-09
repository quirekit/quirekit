import { wordStreams } from '../word'
import type { NoteVector } from './types'

/**
 * Authors exact PLC bytes independently of the production note reader.
 * @param main - Main document text including its paragraph ending.
 * @param footnotes - Ordered footnote references and complete content.
 * @param endnotes - Ordered endnote references and complete content.
 * @returns Root streams with deliberately arbitrary undefined PLC terminators.
 */
export function noteStreams(main: string, footnotes: readonly NoteVector[] = [], endnotes: readonly NoteVector[] = []): Record<string, Uint8Array> {
  const footnoteText = footnotes.length ? footnotes.map(note => note.text).join('') + '\r' : ''
  const endnoteText = endnotes.length ? endnotes.map(note => note.text).join('') + '\r' : ''
  const text = main + footnoteText + endnoteText + (footnotes.length || endnotes.length ? '\r' : '')
  const streams = wordStreams([{ units: Array.from({ length: text.length }, (_, index) => text.charCodeAt(index)), unicode: true }],
    { storyLengths: [main.length, footnoteText.length, 0, 0, endnoteText.length, 0, 0] })
  const header = new DataView(streams.WordDocument!.buffer)
  const segments = [streams['1Table']!]
  let offset = segments[0]!.length
  for (const [notes, referenceIndex, textIndex] of [[footnotes, 2, 3], [endnotes, 46, 47]] as const) {
    if (!notes.length) continue
    const references = new Uint8Array(4 + notes.length * 6)
    const positions = new Uint8Array((notes.length + 2) * 4)
    const referenceView = new DataView(references.buffer)
    const positionView = new DataView(positions.buffer)
    let cp = 0
    notes.forEach((note, index) => {
      referenceView.setUint32(index * 4, note.anchor, true)
      referenceView.setUint16((notes.length + 1) * 4 + index * 2, note.referenceValue ?? 1, true)
      positionView.setUint32(index * 4, cp, true)
      cp += note.text.length
    })
    referenceView.setUint32(notes.length * 4, 0xffffffff, true)
    positionView.setUint32(notes.length * 4, cp, true)
    positionView.setUint32((notes.length + 1) * 4, 0xffffffff, true)
    for (const [index, bytes] of [[referenceIndex, references], [textIndex, positions]] as const) {
      header.setUint32(154 + index * 8, offset, true)
      header.setUint32(158 + index * 8, bytes.length, true)
      segments.push(bytes)
      offset += bytes.length
    }
  }
  const table = new Uint8Array(offset)
  offset = 0
  for (const segment of segments) { table.set(segment, offset); offset += segment.length }
  return { ...streams, '1Table': table }
}
