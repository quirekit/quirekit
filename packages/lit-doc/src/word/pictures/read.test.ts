import { zlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { artRecord, bitmapRecord, inlinePicture, pictureBytes, pictureProperties, pictureString, storageRecord } from '../../testing/pictures/records'
import { createPropertyReader } from '../properties/reader'
import { readInlinePicture } from './read'
import type { PictureReadContext } from './types'

const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)

/** @param data - Data stream. @param word - Separate delay stream. @returns Independent bounded source context. */
function context(data: Uint8Array, word: Uint8Array = new Uint8Array()): PictureReadContext {
  const limits = resolveLimits({})
  return { data, word, limits, reader: createPropertyReader(data, limits), decodedBytes: 0, errorCode: 'invalid-picture-data', propertyBytes: { remaining: limits.maxDrawingPropertyBytes } }
}

describe('bounded inline PICF and OfficeArt reading', () => {
  it.each([0x6e0, 0x6e1])('retains PNG bytes with UID instance %i', instance => {
    const owner = context(inlinePicture([bitmapRecord(png, 0xf01e, instance)]))
    expect(readInlinePicture(0, owner)).toMatchObject({ mime: 'image/png', bytes: png,
      initialWidth: 1200, initialHeight: 800, scaleX: 1000, scaleY: 1000, crop: [0, 0, 0, 0] })
    expect(owner.decodedBytes).toBe(png.length)
  })

  it.each([
    [0xf01d, 0x46a, 'image/jpeg'], [0xf01d, 0x46b, 'image/jpeg'],
    [0xf01d, 0x6e2, 'image/jpeg'], [0xf01d, 0x6e3, 'image/jpeg'],
    [0xf02a, 0x6e2, 'image/jpeg'], [0xf02a, 0x6e3, 'image/jpeg'],
    [0xf029, 0x6e4, 'image/tiff'], [0xf029, 0x6e5, 'image/tiff'],
  ] as const)('retains bitmap type %i and UID instance %i', (type, instance, mime) => {
    const bytes = mime === 'image/jpeg' ? Uint8Array.of(255, 216, 255, 0) : Uint8Array.of(73, 73, 42, 0)
    expect(readInlinePicture(0, context(inlinePicture([bitmapRecord(bytes, type, instance)])))).toMatchObject({ bytes, mime })
  })

  it.each([[0xf01a, 0x3d4, 'image/x-emf'], [0xf01b, 0x216, 'image/x-wmf'], [0xf01c, 0x542, 'image/x-pict']] as const)(
    'keeps metafile type %i with both UID variants and compression modes', (type, instance, mime) => {
      const bytes = Uint8Array.from({ length: 80 }, (_, index) => index)
      for (const twoIds of [false, true]) for (const compressed of [false, true]) {
        const payload = compressed ? zlibSync(bytes) : bytes
        const uid = twoIds ? 32 : 16
        const header = new Uint8Array(uid + 34)
        const view = new DataView(header.buffer)
        view.setUint32(uid, bytes.length, true)
        view.setUint32(uid + 28, payload.length, true)
        header[uid + 32] = compressed ? 0 : 0xfe
        header[uid + 33] = 0xfe
        const source = inlinePicture([artRecord(type, instance + Number(twoIds), 0, pictureBytes(header, payload))])
        expect(readInlinePicture(0, context(source))).toMatchObject({ bytes, mime })
      }
    })

  it('reads a bounded shape-file name before the first OfficeArt record', () => {
    const original = inlinePicture([bitmapRecord(png)])
    const source = pictureBytes(original.subarray(0, 68), Uint8Array.of(3, 97, 98, 99), original.subarray(68))
    const view = new DataView(source.buffer)
    view.setUint32(0, source.length, true)
    view.setUint16(6, 102, true)
    expect(readInlinePicture(0, context(source)).bytes).toEqual(png)
    source[68] = 255
    expect(() => readInlinePicture(0, context(source))).toThrow(expect.objectContaining({ code: 'invalid-picture-data' }))
  })

  it('uses property encounter order even with misleading BLIP flags and indexes', () => {
    const other = bitmapRecord(Uint8Array.of(255, 216, 255, 0), 0xf01d, 0x46a)
    const source = inlinePicture([other, bitmapRecord(png)], [pictureProperties([[271 | 0x4000, 100]]),
      pictureProperties([[260 | 0xc000, 0xffffffff]], 0xf122)])
    expect(readInlinePicture(0, context(source)).bytes).toEqual(png)
  })

  it('keeps signed crop, rotation, flips and UTF-16 occurrence metadata', () => {
    const source = inlinePicture([bitmapRecord(png)], [pictureProperties([[4, -30 * 65536], [256, 8192], [258, -16384],
      [259, 32768], [260, 3], [896, pictureString('图 1')], [897, pictureString('说明 😀')]])], 0x0ac0)
    expect(readInlinePicture(0, context(source))).toMatchObject({ crop: [-16384, 8192, 32768, 0], rotation: -30 * 65536,
      flipX: true, flipY: true, name: '图 1', description: '说明 😀' })
  })

  it('applies aspect-lock use bits without erasing earlier writes to other Boolean fields', () => {
    const source = inlinePicture([bitmapRecord(png)], [pictureProperties([[127, 0x00800080], [260, 1]]),
      pictureProperties([[127, 0x00010001]], 0xf122)])
    expect(readInlinePicture(0, context(source))).toMatchObject({ lockAspect: true, unprojected: [127] })
    const ignored = inlinePicture([bitmapRecord(png)], [pictureProperties([[127, 0x80], [260, 1]])])
    expect(readInlinePicture(0, context(ignored))).toMatchObject({ lockAspect: false, unprojected: [] })
  })

  it('prefers embedded FBSE bytes and resolves a bounded WordDocument delay reference', () => {
    const blip = bitmapRecord(png)
    expect(readInlinePicture(0, context(inlinePicture([storageRecord(blip, 999999)]))).bytes).toEqual(png)
    const word = pictureBytes(new Uint8Array(20), blip)
    expect(readInlinePicture(0, context(inlinePicture([storageRecord(undefined, 20, blip.length)]), word)).bytes).toEqual(png)
    expect(() => readInlinePicture(0, context(inlinePicture([storageRecord(undefined, 9999, blip.length)]), word)))
      .toThrow(expect.objectContaining({ code: 'invalid-picture-data' }))
    expect(() => readInlinePicture(0, context(inlinePicture([storageRecord(undefined, 0, 44)]), storageRecord(undefined, 0, 44))))
      .toThrow(expect.objectContaining({ code: 'invalid-picture-data' }))
  })

  it('rejects truncated extents, invalid instances and empty or ambiguous picture authorities', () => {
    const good = inlinePicture([bitmapRecord(png)])
    expect(() => readInlinePicture(0, context(good.subarray(0, good.length - 1)))).toThrow(/Byte range/)
    expect(() => readInlinePicture(0, context(inlinePicture([bitmapRecord(png, 0xf01e, 0)])))).toThrow(/instance/)
    expect(() => readInlinePicture(0, context(inlinePicture([], [])))).toThrow(/display BLIP/)
    expect(() => readInlinePicture(0, context(inlinePicture([bitmapRecord(png), bitmapRecord(png)]))))
      .toThrow(/BLIP.*count/)
    expect(() => readInlinePicture(0, context(inlinePicture([bitmapRecord(png)], [pictureProperties([[260, 1], [897, Uint8Array.of(65, 0)]])]))))
      .toThrow(/terminator/)
  })

  it('charges decoded media before allocating and keeps aggregate limits finite', () => {
    const owner = context(inlinePicture([bitmapRecord(png)]))
    owner.limits.maxPictureBytes = png.length - 1
    expect(() => readInlinePicture(0, owner)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    owner.limits.maxPictureBytes = png.length
    owner.limits.maxTotalPictureBytes = png.length
    readInlinePicture(0, owner)
    expect(() => readInlinePicture(0, owner)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('inflates metafiles with exact size and checksum checks, rejecting expansion beyond the declaration', () => {
    const bytes = Uint8Array.from({ length: 4000 }, (_, index) => index % 251)
    const compressed = zlibSync(bytes)
    const header = new Uint8Array(16 + 34)
    const view = new DataView(header.buffer)
    view.setUint32(16, bytes.length, true)
    view.setUint32(44, compressed.length, true)
    header[49] = 0xfe
    /** @returns Independently wrapped metafile with the current test header/payload. */
    function source() { return context(inlinePicture([artRecord(0xf01a, 0x3d4, 0, pictureBytes(header, compressed))])) }
    expect(readInlinePicture(0, source())).toMatchObject({ bytes, mime: 'image/x-emf' })
    view.setUint32(16, 1, true)
    expect(() => readInlinePicture(0, source())).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    view.setUint32(16, bytes.length, true)
    compressed[compressed.length - 1]! ^= 1
    expect(() => readInlinePicture(0, source())).toThrow(/checksum/)
  })
})
