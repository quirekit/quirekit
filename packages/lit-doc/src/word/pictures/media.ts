import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import { inflatePicture } from './inflate'
import { chargePictureBytes } from './budget'
import { readOfficeArtRecord } from '../office-art/records'
import type { OfficeArtRecord } from '../office-art/types'
import type { PictureReadContext, SourcePicture } from './types'

const mediaTypes = new Map([
  [0xf01a, { instance: 0x3d4, mime: 'image/x-emf', metafile: true }],
  [0xf01b, { instance: 0x216, mime: 'image/x-wmf', metafile: true }],
  [0xf01c, { instance: 0x542, mime: 'image/x-pict', metafile: true }],
  [0xf01d, { instance: 0x46a, mime: 'image/jpeg', metafile: false }],
  [0xf01e, { instance: 0x6e0, mime: 'image/png', metafile: false }],
  [0xf029, { instance: 0x6e4, mime: 'image/tiff', metafile: false }],
  [0xf02a, { instance: 0x6e2, mime: 'image/jpeg', metafile: false }],
])

/** @param record - FBSE file block or direct BLIP. @param context - Separate source streams and budget. @returns Direct bounded BLIP without following nested storage records. */
function resolveBlip(record: OfficeArtRecord, context: PictureReadContext): OfficeArtRecord {
  if (record.type !== 0xf007) return record
  const view = new ByteView(record.data, 'invalid-picture-data')
  view.check(0, 36)
  requireDoc(record.version === 2 && (record.instance === view.u8(0) || record.instance === view.u8(1)),
    'invalid-picture-data', 'Invalid picture storage record header')
  const nameSize = view.u8(33)
  requireDoc(nameSize % 2 === 0, 'invalid-picture-data', 'Invalid picture storage name length')
  view.check(36, nameSize)
  if (nameSize) requireDoc(view.u16(34 + nameSize) === 0, 'invalid-picture-data', 'Missing picture storage name terminator')
  const start = 36 + nameSize
  const size = view.u32(20)
  const embedded = start < record.data.length
  const bytes = embedded ? view.slice(start, record.data.length - start)
    : new ByteView(context.word, 'invalid-picture-data').slice(view.u32(28), size)
  const result = readOfficeArtRecord(bytes, 0, context)
  requireDoc(result.type !== 0xf007 && result.end === bytes.length && result.end === size,
    'invalid-picture-data', 'Invalid stored BLIP extent or nested storage reference')
  return result
}

/** @param bytes - Exact original file. @param mime - Declared bitmap format. */
function validateBitmap(bytes: Uint8Array, mime: string): void {
  let valid = true
  if (mime === 'image/png') valid = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
  if (mime === 'image/jpeg') valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (mime === 'image/tiff') valid = bytes.length >= 4 && (bytes[0] === 73 && bytes[1] === 73 && bytes[2] === 42 && bytes[3] === 0
    || bytes[0] === 77 && bytes[1] === 77 && bytes[2] === 0 && bytes[3] === 42)
  requireDoc(valid, 'invalid-picture-data', 'Picture signature disagrees with its BLIP type')
}

/** @param record - Direct or stored BLIP. @param context - Shared decoded-byte and record budgets. @returns Portable media payload with format identity. */
export function readPictureMedia(record: OfficeArtRecord, context: PictureReadContext): Pick<SourcePicture, 'bytes' | 'mime'> {
  const blip = resolveBlip(record, context)
  const type = mediaTypes.get(blip.type)
  requireDoc(type, 'unsupported-picture', `Unsupported picture BLIP type 0x${blip.type.toString(16)}`)
  const base = blip.type === 0xf01d && (blip.instance & ~1) === 0x6e2 ? 0x6e2 : type.instance
  requireDoc(blip.version === 0 && (blip.instance === base || blip.instance === base + 1),
    'invalid-picture-data', 'Invalid picture BLIP version or UID instance')
  const uidSize = blip.instance === base ? 16 : 32
  const view = new ByteView(blip.data, 'invalid-picture-data')
  let bytes: Uint8Array
  if (type.metafile) {
    view.check(uidSize, 34)
    const size = view.u32(uidSize)
    const stored = view.u32(uidSize + 28)
    const compression = view.u8(uidSize + 32)
    requireDoc(view.u8(uidSize + 33) === 0xfe && (compression === 0 || compression === 0xfe),
      'unsupported-picture', 'Unsupported metafile compression or filter')
    requireDoc(blip.data.length - uidSize - 34 === stored, 'invalid-picture-data', 'Metafile stored length disagrees with its record')
    chargePictureBytes(context, size)
    const payload = view.slice(uidSize + 34, stored)
    requireDoc(compression !== 0xfe || size === stored, 'invalid-picture-data', 'Uncompressed metafile length mismatch')
    bytes = compression === 0 ? inflatePicture(payload, size) : payload.slice()
  } else {
    view.check(0, uidSize + 1)
    const payload = view.slice(uidSize + 1, blip.data.length - uidSize - 1)
    chargePictureBytes(context, payload.length)
    validateBitmap(payload, type.mime)
    bytes = payload.slice()
  }
  return { bytes, mime: type.mime }
}
