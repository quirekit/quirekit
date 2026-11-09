import { artRecord, pictureBytes, pictureProperties } from '../pictures/records'
import { drawingShape } from '../drawings/streams'
import { operation } from '../formatting'
import { fieldDocument } from '../fields/conversion'
import type { TextboxAuthorVector } from './types'

/** @param properties - Independent shape-property writes. @param chain - Original FTX chain length. @param txid - Original Word textbox identity. @param shapeField - Whether a legacy SHAPE field owns the displayed source frame. @param author - Optional independent author content and resources. @returns Actual binary DOC containing one ordinary formatted textbox and separate main text. */
export function textboxDocument(properties: readonly (readonly [number, number])[] = [], chain = 1, txid = 65536, shapeField = false, author?: TextboxAuthorVector): Uint8Array {
  const body = shapeField ? 'A\u0013 SHAPE \u0014\u0008\u0015B\r' : 'A\u0008B\r', position = body.indexOf('\u0008'), base = body.length
  const contentText = author?.text ?? 'Bold\r\r', count = author?.duplicateOwner ? 2 : 1
  const text = `${body}${`${contentText}\r`.repeat(count)}\r\r`, cuts = [0,
    ...Array.from({ length: text.length }, (_, index) => index + 1).filter(end => text.charCodeAt(end - 1) === 13)]
  const fsp = new Uint8Array(8), shape = new DataView(fsp.buffer)
  shape.setUint32(0, 1026, true); shape.setUint32(4, 0xa00, true)
  const client = new Uint8Array(4); new DataView(client.buffer).setUint32(0, txid, true)
  const content = pictureBytes(artRecord(0xf000, 0, 15, new Uint8Array()), Uint8Array.of(0), artRecord(0xf002, 0, 15,
    artRecord(0xf003, 0, 15, pictureBytes(drawingShape(1024, true), artRecord(0xf004, 0, 15, pictureBytes(
      artRecord(0xf00a, 202, 2, fsp), pictureProperties([[128, 65536], ...properties]), artRecord(0xf00d, 0, 0, client),
      artRecord(0xf010, 0, 0, new Uint8Array(4)), artRecord(0xf011, 0, 0, new Uint8Array(4))))))))
  const main = new Uint8Array(34), anchor = new DataView(main.buffer)
  anchor.setUint32(0, position, true); anchor.setUint32(4, 0xffffffff, true); anchor.setUint32(8, 1026, true)
  for (const [axis, value] of [-30, 40, 1470, 1165].entries()) anchor.setInt32(12 + axis * 4, value, true)
  anchor.setUint16(28, 0x54, true)
  return fieldDocument(text, {
    drawings: { content, main }, storyLengths: [base, 0, 0, 0, 0, (contentText.length + 1) * count + 1, 0],
    ...(author?.data ? { data: author.data } : {}),
    characters: [{ start: position, end: position + 1, operations: operation(0x0855, 1) },
      ...(author ? author.characters ?? [] : [{ start: 0, end: 4, operations: operation(0x0835, 1) }]).map(span => ({ ...span, start: base + span.start, end: base + span.end }))],
    paragraphs: cuts.slice(0, -1).map((start, index) => ({ start, end: cuts[index + 1]!, operations: [] })),
    textboxes: [{ kind: 'textbox', entries: [
      ...Array.from({ length: count }, (_, index) => ({ start: (contentText.length + 1) * index, end: (contentText.length + 1) * (index + 1),
        data: [chain, 0] as const, reuseFlags: 0, destination: 0xffffffff, shapeId: 1026, undoTextId: 0 })),
      { start: (contentText.length + 1) * count, end: text.length + 1, data: [0, 0], reuseFlags: 0, destination: 0, shapeId: 0, undoTextId: 0 },
    ] }],
  })
}
