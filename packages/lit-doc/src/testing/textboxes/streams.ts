import { wordStreams } from '../word'
import type { TextboxBreakVector, TextboxEntryVector, TextboxPartVector } from './types'

/** @param entries - Independent physical table records. @param width - Original 22/6-byte record size. @returns Exact CP array and original record payload bytes. */
function plc(entries: readonly (TextboxEntryVector | TextboxBreakVector)[], width: 22 | 6): Uint8Array {
  const bytes = new Uint8Array(4 + entries.length * (width + 4)), view = new DataView(bytes.buffer)
  entries.forEach((entry, index) => {
    view.setUint32(index * 4, entry.start, true); view.setUint32((index + 1) * 4, entry.end, true)
    const at = (entries.length + 1) * 4 + index * width
    if ('reuseFlags' in entry) {
      view.setUint32(at, entry.data[0], true); view.setUint32(at + 4, entry.data[1], true)
      view.setUint16(at + 8, entry.reuseFlags, true); view.setUint32(at + 10, entry.destination, true)
      view.setUint32(at + 14, entry.shapeId, true); view.setUint32(at + 18, entry.undoTextId, true)
    } else {
      view.setUint16(at, entry.textboxIndex, true); view.setInt16(at + 2, entry.dependency, true); view.setUint16(at + 4, entry.flags, true)
    }
  })
  return bytes
}

/** @param textbox - Complete original body textbox storage. @param headerTextbox - Original header textbox storage. @param parts - Independent raw tables, including spare records. @returns Exact source FIB/CLX and appended textbox PLCs. */
export function textboxStreams(textbox: string, headerTextbox: string, parts: readonly TextboxPartVector[]): Record<string, Uint8Array> {
  const text = `M\r${textbox}${headerTextbox}${textbox.length || headerTextbox.length ? '\r' : ''}`
  const streams = wordStreams([{ units: Array.from({ length: text.length }, (_, index) => text.charCodeAt(index)), unicode: true }],
    { storyLengths: [2, 0, 0, 0, 0, textbox.length, headerTextbox.length] })
  return withTextboxTables(streams, parts)
}

/** @param streams - Independently encoded source text and formatting. @param parts - Original raw textbox tables. @returns New source locators and table stream. */
export function withTextboxTables(streams: Record<string, Uint8Array>, parts: readonly TextboxPartVector[]): Record<string, Uint8Array> {
  const word = new DataView(streams.WordDocument!.buffer), segments = [streams['1Table']!]
  let length = segments[0]!.length
  for (const part of parts) for (const [slot, bytes] of [
    [part.kind === 'textbox' ? 56 : 58, part.entries && plc(part.entries, 22)],
    [part.kind === 'textbox' ? 75 : 76, part.breaks && plc(part.breaks, 6)],
  ] as const) if (bytes) {
    word.setUint32(154 + slot * 8, length, true); word.setUint32(158 + slot * 8, bytes.length, true)
    segments.push(bytes); length += bytes.length
  }
  const table = new Uint8Array(length)
  let offset = 0
  for (const segment of segments) { table.set(segment, offset); offset += segment.length }
  return { ...streams, '1Table': table }
}
