import { artRecord, bitmapRecord, pictureBytes, pictureProperties, storageRecord } from '../pictures/records'
import { drawingShape } from './streams'
import type { DrawingDocumentFixture, FloatingPictureFixtureOptions } from './types'

/** @param properties - Complete original local property records. @param flags - FSPA wrap/reference flags. @param shapeFlags - Independent FSP role flags. @param options - Independent occurrences and intentional invalid associations. @returns Original floating frames sharing one global media store. */
export function floatingPictureFixture(properties: readonly Uint8Array[] = [], flags = 0x54, shapeFlags = 0xa00,
  options: FloatingPictureFixtureOptions = {}): DrawingDocumentFixture {
  const image = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)
  const group = artRecord(0xf000, 0, 15, artRecord(0xf001, 1, 15, storageRecord(bitmapRecord(image))))
  const positions = options.positions ?? [1]
  const shapes = positions.map((_, index) => {
    const fsp = new Uint8Array(8), identity = new DataView(fsp.buffer)
    identity.setUint32(0, 1025 + index, true); identity.setUint32(4, shapeFlags, true)
    const client = new Uint8Array(4)
    new DataView(client.buffer).setUint32(0, options.clientIndices?.[index] ?? index + (options.clientIndexOffset ?? 0), true)
    return artRecord(0xf004, 0, 15, pictureBytes(artRecord(0xf00a, 75, 2, fsp),
      pictureProperties([[0x4104, 1]]), ...properties, artRecord(0xf010, 0, 0, client), artRecord(0xf011, 0, 0, new Uint8Array(4))))
  })
  const content = pictureBytes(group, Uint8Array.of(0), artRecord(0xf002, 0, 15,
    artRecord(0xf003, 0, 15, pictureBytes(drawingShape(1024, true), ...shapes))))
  const main = new Uint8Array(4 + positions.length * 30), anchors = new DataView(main.buffer)
  positions.forEach((position, index) => {
    anchors.setUint32(index * 4, position, true)
    const offset = (positions.length + 1) * 4 + index * 26
    anchors.setUint32(offset, options.anchorShapeIds?.[index] ?? 1025 + index, true)
    for (const [axis, value] of [-30, 40, 1470, 1165].entries()) anchors.setInt32(offset + 4 + axis * 4, value, true)
    anchors.setUint16(offset + 20, flags, true)
  })
  anchors.setUint32(positions.length * 4, 0xffffffff, true)
  return { content, main }
}
