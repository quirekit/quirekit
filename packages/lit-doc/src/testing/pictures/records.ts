/** @param parts - Independently encoded byte spans. @returns Contiguous fixture bytes. */
export function pictureBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let position = 0
  for (const part of parts) {
    bytes.set(part, position)
    position += part.length
  }
  return bytes
}

/** @param type - OfficeArt record code. @param instance - Header instance. @param version - Version nibble. @param data - Exact payload. @returns Independent binary record. */
export function artRecord(type: number, instance: number, version: number, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(8 + data.length)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, instance * 16 + version, true)
  view.setUint16(2, type, true)
  view.setUint32(4, data.length, true)
  bytes.set(data, 8)
  return bytes
}

/** @param data - Complete original raster file. @param type - BLIP type. @param instance - Explicit one/two UID discriminator. @returns Raster BLIP record. */
export function bitmapRecord(data: Uint8Array, type = 0xf01e, instance = 0x6e0): Uint8Array {
  const prefix = new Uint8Array((instance & 1 ? 32 : 16) + 1)
  prefix[prefix.length - 1] = 255
  return artRecord(type, instance, 0, pictureBytes(prefix, data))
}

/** @param blip - Embedded record, or absent for a delayed file. @param delay - WordDocument offset. @param size - Declared BLIP extent. @returns FBSE record with a separate delay pointer. */
export function storageRecord(blip?: Uint8Array, delay = 0xffffffff, size = blip?.length ?? 0): Uint8Array {
  const header = new Uint8Array(36)
  const view = new DataView(header.buffer)
  header[0] = 6
  header[1] = 6
  view.setUint32(20, size, true)
  view.setUint32(24, 1, true)
  view.setUint32(28, delay, true)
  return artRecord(0xf007, 6, 2, pictureBytes(header, blip ?? new Uint8Array()))
}

/** @param rows - Property id/value tuples, with bytes for complex data. @param type - Primary or tertiary property table. @returns Independent property table. */
export function pictureProperties(rows: readonly (readonly [number, number | Uint8Array])[], type = 0xf00b): Uint8Array {
  const fixed = new Uint8Array(rows.length * 6)
  const view = new DataView(fixed.buffer)
  const complex: Uint8Array[] = []
  rows.forEach(([id, value], index) => {
    view.setUint16(index * 6, id | (typeof value === 'number' ? 0 : 0x8000), true)
    view.setUint32(index * 6 + 2, typeof value === 'number' ? value >>> 0 : value.length, true)
    if (typeof value !== 'number') complex.push(value)
  })
  return artRecord(type, rows.length, 3, pictureBytes(fixed, ...complex))
}

/** @param text - Source metadata. @returns UTF-16LE including its terminator. */
export function pictureString(text: string): Uint8Array {
  const bytes = new Uint8Array((text.length + 1) * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < text.length; index++) view.setUint16(index * 2, text.charCodeAt(index), true)
  return bytes
}

/** @param blips - Complete BLIP/FBSE file blocks. @param properties - Ordered property table records. @param flags - Source shape flags. @returns PICF and its inline drawing container. */
export function inlinePicture(blips: readonly Uint8Array[], properties = [pictureProperties([[260, 1]])], flags = 0x0a00): Uint8Array {
  const shape = new Uint8Array(8)
  new DataView(shape.buffer).setUint32(4, flags, true)
  const art = pictureBytes(artRecord(0xf004, 0, 15,
    pictureBytes(artRecord(0xf00a, 75, 2, shape), ...properties)), ...blips)
  const header = new Uint8Array(68)
  const view = new DataView(header.buffer)
  view.setUint32(0, header.length + art.length, true)
  view.setUint16(4, 68, true)
  view.setUint16(6, 100, true)
  view.setInt16(28, 1200, true)
  view.setInt16(30, 800, true)
  view.setUint16(32, 1000, true)
  view.setUint16(34, 1000, true)
  return pictureBytes(header, art)
}
