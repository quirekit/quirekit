import { artRecord, bitmapRecord, pictureBytes, pictureProperties, storageRecord } from '../pictures/records'
import { drawingShape } from './streams'
import { fieldDocument } from '../fields/conversion'
import { operation } from '../formatting'

/** @param bounds - Independent original integer rectangle. @returns Signed little-endian rectangle bytes. */
function rectangle(bounds: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(16), view = new DataView(bytes.buffer)
  bounds.forEach((value, index) => view.setInt32(index * 4, value, true)); return bytes
}

/** @param id - Original shape id. @param type - Public shape type. @param flags - Exact original flags. @param records - Independently encoded records. @returns Complete OfficeArt shape. */
function shape(id: number, type: number, flags: number, records: readonly Uint8Array[]): Uint8Array {
  const identity = new Uint8Array(8), view = new DataView(identity.buffer)
  view.setUint32(0, id, true); view.setUint32(4, flags, true)
  return artRecord(0xf004, 0, 15, pictureBytes(artRecord(0xf00a, type, 2, identity), ...records))
}

/** @param id - Original text owner. @param textId - Original FTX slot/sequence. @param bounds - Original child rectangle. @param rotation - Original local fixed-point rotation. @returns Ordinary child textbox. */
function textbox(id: number, textId: number, bounds: readonly number[], rotation = 0): Uint8Array {
  const client = new Uint8Array(4); new DataView(client.buffer).setUint32(0, textId, true)
  return shape(id, 202, 0xa02, [artRecord(0xf00f, 0, 0, rectangle(bounds)), pictureProperties([[128, textId], [4, rotation]]),
    artRecord(0xf00d, 0, 0, client), artRecord(0xf011, 0, 0, new Uint8Array(4))])
}

/** @param options - Independent malformed branches or nested coordinate systems. @param options.nested - Whether the second text owner is in a nested group. @param options.invalidLast - Whether the final text owner references an absent FTX slot. @param options.rotation - Original parent rotation. @param options.childRotation - Original first leaf rotation. @param options.anisotropic - Whether physical parent scale differs between axes. @param options.duplicateId - Whether two real leaves illegally reuse one id. @returns Actual DOC with picture and independently owned rich-text children. */
export function groupedDrawingDocument(options: { nested?: boolean, invalidLast?: boolean, rotation?: number, childRotation?: number, anisotropic?: boolean, duplicateId?: boolean } = {}): Uint8Array {
  const image = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)
  const store = artRecord(0xf000, 0, 15, artRecord(0xf001, 1, 15, storageRecord(bitmapRecord(image))))
  const first = textbox(1027, 65536, [50, 75, 450, 225], options.childRotation)
  const second = textbox(options.duplicateId ? 1027 : 1028, options.invalidLast ? 196608 : 131072, options.nested ? [0, 0, 500, 250] : [450, 275, 950, 525])
  const nested = options.nested ? artRecord(0xf003, 0, 15, pictureBytes(
    shape(1040, 0, 0x203, [artRecord(0xf009, 0, 1, rectangle([0, 0, 500, 250])), artRecord(0xf00f, 0, 0, rectangle([450, 275, 950, 525]))]), second)) : second
  const picture = shape(1029, 75, 0xa02, [artRecord(0xf00f, 0, 0, rectangle([-50, 25, 50, 75])),
    pictureProperties([[0x4104, 1]]), artRecord(0xf011, 0, 0, new Uint8Array(4))])
  const group = artRecord(0xf003, 0, 15, pictureBytes(
    shape(1026, 0, 0x201, [artRecord(0xf009, 0, 1, rectangle([-50, 25, 950, 525])),
      pictureProperties(options.rotation === undefined ? [] : [[4, options.rotation]]), artRecord(0xf010, 0, 0, new Uint8Array(4))]), picture, first, nested))
  const drawing = pictureBytes(store, Uint8Array.of(0), artRecord(0xf002, 0, 15,
    artRecord(0xf003, 0, 15, pictureBytes(drawingShape(1024, true), group))))
  const main = new Uint8Array(34), anchor = new DataView(main.buffer)
  anchor.setUint32(0, 1, true); anchor.setUint32(4, 0xffffffff, true); anchor.setUint32(8, 1026, true)
  for (const [index, value] of [-30, 40, 1470, options.anisotropic ? 800 : 790].entries()) anchor.setInt32(12 + index * 4, value, true)
  anchor.setUint16(28, 0x60, true)
  const text = 'A\u0008B\rOne\r\rTwo\r\r\r\r', cuts = [0, 4, 8, 9, 13, 14, 15, 16]
  return fieldDocument(text, { drawings: { content: drawing, main }, storyLengths: [4, 0, 0, 0, 0, 11, 0],
    characters: [{ start: 1, end: 2, operations: operation(0x0855, 1) }],
    paragraphs: cuts.slice(0, -1).map((start, index) => ({ start, end: cuts[index + 1]!, operations: [] })),
    textboxes: [{ kind: 'textbox', entries: [
      { start: 0, end: 5, data: [1, 0], reuseFlags: 0, destination: 0xffffffff, shapeId: 1027, undoTextId: 0 },
      { start: 5, end: 10, data: [1, 0], reuseFlags: 0, destination: 0xffffffff, shapeId: 1028, undoTextId: 0 },
      { start: 10, end: 17, data: [0, 0], reuseFlags: 0, destination: 0, shapeId: 0, undoTextId: 0 }
    ] }] })
}
