import { artRecord, pictureBytes, pictureProperties, pictureString } from '../pictures/records'
import { wordStreams } from '../word'

/** @param id - Independently assigned source identity. @param group - Whether this shape is a structural group. @returns Complete source shape. */
export function drawingShape(id: number, group = false): Uint8Array {
  const fsp = new Uint8Array(8), view = new DataView(fsp.buffer)
  view.setUint32(0, id, true); view.setUint32(4, group ? 5 : 0xa00, true)
  return artRecord(0xf004, 0, 15, pictureBytes(artRecord(0xf00a, group ? 0 : 75, 2, fsp),
    ...(group ? [] : [pictureProperties([[0xc0, pictureString('DRAFT CONTRACT')], [0x4104, 1]]),
      pictureProperties([[0x391, 1], [0x392, 4]], 0xf122)])))
}

/** @param part - Main=0 or header=1. @param nested - Optional nested raw group fixture. @returns Label and complete part drawing. */
export function labelledDrawing(part: number, nested?: Uint8Array): Uint8Array {
  const id = 1024 + part * 100
  return pictureBytes(Uint8Array.of(part), artRecord(0xf002, 0, 15,
    artRecord(0xf003, 0, 15, pictureBytes(drawingShape(id, true), drawingShape(id + 1), ...(nested ? [nested] : [])))))
}

/** @param positions - Actual source-relative anchor CPs. @param shapeId - Original source id. @param terminal - Undefined PLC terminal value. @returns Exact 26-byte anchor PLC. */
export function drawingAnchors(positions: readonly number[] = [0], shapeId = 1025, terminal = 0xffffffff): Uint8Array {
  const bytes = new Uint8Array(4 + positions.length * 30), view = new DataView(bytes.buffer)
  positions.forEach((position, index) => {
    view.setUint32(index * 4, position, true)
    const offset = (positions.length + 1) * 4 + index * 26
    view.setUint32(offset, shapeId, true)
    for (const [axis, value] of [-100, 200, 900, 1200].entries()) view.setInt32(offset + 4 + axis * 4, value, true)
    view.setUint16(offset + 20, 0xffff, true); view.setUint32(offset + 22, 0xffffffff, true)
  })
  view.setUint32(positions.length * 4, terminal, true)
  return bytes
}

/** @param content - Complete optional OfficeArt source. @param main - Optional exact main anchor table. @param header - Optional exact header anchor table. @returns Independent FIB/CLX and appended drawing records. */
export function drawingStreams(content?: Uint8Array, main?: Uint8Array, header?: Uint8Array): Record<string, Uint8Array> {
  const streams = wordStreams([{ units: [8, 13, 8, 13, 13], unicode: true }], { storyLengths: [2, 0, 2, 0, 0, 0, 0] })
  return withDrawingTables(streams, content, main, header)
}

/** @param streams - Original independently encoded format/text streams. @param content - Optional OfficeArt content. @param main - Optional main anchor PLC. @param header - Optional header anchor PLC. @returns New FIB locators and appended drawing source bytes. */
export function withDrawingTables(streams: Record<string, Uint8Array>, content?: Uint8Array, main?: Uint8Array, header?: Uint8Array): Record<string, Uint8Array> {
  const old = streams['1Table']!, wordBytes = streams.WordDocument!.slice(), word = new DataView(wordBytes.buffer)
  const parts = [[40, main], [41, header], [50, content]] as const
  let offset = old.length
  for (const [slot, part] of parts) if (part) {
    word.setUint32(154 + slot * 8, offset, true); word.setUint32(158 + slot * 8, part.length, true)
    offset += part.length
  }
  return { ...streams, WordDocument: wordBytes, '1Table': pictureBytes(old, ...parts.flatMap(([, part]) => part ? [part] : [])) }
}
