import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import { readOfficeArtRecords } from '../office-art/records'
import { readOfficeArtProperties } from '../office-art/properties'
import type { OfficeArtProperty, OfficeArtRecord } from '../office-art/types'
import type { PictureReadContext, PictureShape } from './types'

// Inline containers store these media roles in encounter order. Their fBid,
// fComplex and scalar values do not address the global drawing image store.
const blipRoles = new Set([260, 271, 390, 453, 1349, 1413, 1477, 1541])

/** @param record - Inline shape container. @param context - Shared record/property work budget. @returns Shape identity and ordered properties. */
export function readPictureShape(record: OfficeArtRecord, context: PictureReadContext): PictureShape {
  requireDoc(record.type === 0xf004 && record.version === 15 && record.instance === 0,
    'invalid-picture-data', 'Invalid inline picture shape container')
  const children = readOfficeArtRecords(record.data, context)
  const shapes = children.filter(child => child.type === 0xf00a)
  requireDoc(shapes.length === 1, 'invalid-picture-data', 'Inline picture requires one shape authority')
  const shape = shapes[0]!
  requireDoc(shape.version === 2 && shape.data.length === 8, 'invalid-picture-data', 'Invalid picture shape record')
  requireDoc(shape.instance === 75, 'unsupported-picture', 'Inline shape is outside the ordinary picture-frame path')
  const flags = new ByteView(shape.data, 'invalid-picture-data').u32(4)
  requireDoc((flags & ~0x0ac0) === 0, 'unsupported-picture', 'Unsupported inline picture shape flags')
  const properties = children.flatMap(child => child.type === 0xf00b || child.type === 0xf122 ? readOfficeArtProperties(child, context, blipRoles) : [])
  return { flags, properties, blipRoles: properties.filter(property => blipRoles.has(property.id)).map(property => property.id),
    unprojectedRecords: children.filter(child => ![0xf00a, 0xf00b, 0xf122].includes(child.type)).map(child => child.type) }
}

/** @param property - Optional UTF-16 complex property. @returns Exact terminated metadata or absence. */
export function pictureText(property: OfficeArtProperty | undefined): string | null {
  if (!property) return null
  const bytes = property.complex
  requireDoc(bytes && bytes.length >= 2 && bytes.length % 2 === 0, 'invalid-picture-data', 'Invalid picture string extent')
  const view = new ByteView(bytes, 'invalid-picture-data')
  requireDoc(view.u16(bytes.length - 2) === 0, 'invalid-picture-data', 'Missing picture string terminator')
  return readUtf16Units(view, 0, bytes.length / 2 - 1)
}
