import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import { readPictureMedia } from './media'
import { pictureText, readPictureShape } from './properties'
import { readOfficeArtRecords } from '../office-art/records'
import type { PictureReadContext, SourcePicture } from './types'

/** @param offset - Explicit character-owned Data stream offset. @param context - Private source bytes and finite decode limits. @returns Complete portable picture and occurrence geometry. */
export function readInlinePicture(offset: number, context: PictureReadContext): SourcePicture {
  requireDoc(context.data, 'invalid-picture-data', 'Inline picture requires a Data stream')
  const data = new ByteView(context.data, 'invalid-picture-data')
  const length = data.u32(offset)
  requireDoc(length >= 68 && length <= 0x7fffffff, 'invalid-picture-data', 'Invalid PICF record length')
  const view = new ByteView(data.slice(offset, length), 'invalid-picture-data')
  requireDoc(view.u16(4) === 68, 'invalid-picture-data', 'Invalid PICF header size')
  const mode = view.u16(6)
  requireDoc(mode === 100 || mode === 102, 'unsupported-picture', 'Unsupported legacy picture mapping mode')
  const start = mode === 102 ? 69 + view.u8(68) : 68
  const records = readOfficeArtRecords(view.slice(start, length - start), context)
  requireDoc(records.length > 0, 'invalid-picture-data', 'Missing inline picture shape')
  const shape = readPictureShape(records[0]!, context)
  const display = shape.blipRoles.indexOf(260)
  requireDoc(display >= 0 && shape.blipRoles.lastIndexOf(260) === display,
    'unsupported-picture', 'Inline picture requires one display BLIP authority')
  requireDoc(records.length - 1 === shape.blipRoles.length, 'invalid-picture-data', 'Inline picture BLIP record count disagrees with properties')
  requireDoc(records.slice(1).every(record => record.type === 0xf007 || record.type >= 0xf018 && record.type <= 0xf117),
    'invalid-picture-data', 'Invalid inline picture file block')

  // Container lengths and all complex data are validated before media expansion.
  // Source dimensions belong to the frame, independently of the crop rectangle.
  const initialWidth = view.u16(28)
  const initialHeight = view.u16(30)
  const scaleX = view.u16(32)
  const scaleY = view.u16(34)
  requireDoc(initialWidth > 0 && initialWidth <= 0x7fff && initialHeight > 0 && initialHeight <= 0x7fff,
    'invalid-picture-data', 'Invalid initial picture dimensions')
  for (const dimension of [initialWidth * scaleX / 1000, initialHeight * scaleY / 1000])
    requireDoc(dimension >= 15 && dimension <= 31680, 'invalid-picture-data', 'Scaled picture dimensions are outside the source range')
  const properties = new Map(shape.properties.map(property => [property.id, property]))
  /** @param id - Signed scalar property. @returns Source value or its format default. */
  function scalar(id: number): number {
    const property = properties.get(id)
    requireDoc(!property?.complex, 'invalid-picture-data', 'Scalar picture property has complex data')
    return (property?.value ?? 0) | 0
  }
  const crop = [scalar(258), scalar(256), scalar(259), scalar(257)] as const
  requireDoc(crop[0] + crop[2] < 65536 && crop[1] + crop[3] < 65536,
    'invalid-picture-data', 'Picture crop has no positive visible source area')
  const name = pictureText(properties.get(896))
  const description = pictureText(properties.get(897))
  const projected = new Set([4, 256, 257, 258, 259, 260, 896, 897])
  let lockAspect = false
  let otherLocks = false
  for (const property of shape.properties) if (property.id === 127) {
    requireDoc(!property.complex, 'invalid-picture-data', 'Picture protection flags have complex data')
    if (property.value & 0x00800000) lockAspect = Boolean(property.value & 0x80)
    if ((property.value >>> 16 & 0x3ff & ~0x80) !== 0) otherLocks = true
  }
  if (!otherLocks) projected.add(127)
  return { offset, ...readPictureMedia(records[display + 1]!, context), initialWidth, initialHeight, scaleX, scaleY,
    crop, rotation: scalar(4), flipX: Boolean(shape.flags & 0x40), flipY: Boolean(shape.flags & 0x80), lockAspect,
    name, description, unprojected: [...properties.keys()].filter(id => !projected.has(id)), unprojectedRecords: shape.unprojectedRecords,
    hasBorders: [46, 50, 54, 58].some(position => view.u32(position) !== 0 && view.u32(position) !== 0xffffffff) }
}
