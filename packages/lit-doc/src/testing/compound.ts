const free = 0xffffffff
const end = 0xfffffffe

/**
 * Constructs small, independent CFB vectors from the published sector layout.
 * @param sources - Root stream names and bytes.
 * @param options - Container version and optional extended allocation map.
 * @returns Complete synthetic container; this is not a Word producer fixture.
 */
export function compoundFixture(sources: Record<string, Uint8Array>, options: {
  version?: 3 | 4, extendedDifat?: boolean,
} = {}): Uint8Array {
  const version = options.version ?? 3
  const size = version === 3 ? 512 : 4096
  const entries = Object.entries(sources).sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
  const miniUnits = entries.reduce((sum, [, bytes]) => sum + (bytes.length < 4096 ? Math.ceil(bytes.length / 64) : 0), 0)
  const miniCount = Math.ceil(miniUnits * 4 / size)
  const rootCount = Math.ceil(miniUnits * 64 / size)
  const directoryCount = Math.ceil((entries.length + 1) * 128 / size)
  const regularCount = entries.reduce((sum, [, bytes]) => sum + (bytes.length >= 4096 ? Math.ceil(bytes.length / size) : 0), 0)
  let fatCount = options.extendedDifat ? 110 : 1
  let difatCount = fatCount > 109 ? 1 : 0
  while (fatCount * size / 4 < fatCount + difatCount + directoryCount + miniCount + rootCount + regularCount) {
    fatCount++
    difatCount = fatCount > 109 ? 1 : 0
  }
  const directory = fatCount + difatCount
  const miniFat = directory + directoryCount
  const miniRoot = miniFat + miniCount
  const regular = miniRoot + rootCount
  const sectorCount = regular + regularCount
  const bytes = new Uint8Array((sectorCount + 1) * size)
  const view = new DataView(bytes.buffer)
  const fat = new Uint32Array(fatCount * size / 4).fill(free)
  const miniature = new Uint32Array(miniCount * size / 4).fill(free)

  // Header and allocation tables are constructed from constants, not reader helpers.
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  view.setUint16(24, 0x3e, true); view.setUint16(26, version, true)
  view.setUint16(28, 0xfffe, true); view.setUint16(30, version === 3 ? 9 : 12, true)
  view.setUint16(32, 6, true); view.setUint32(40, version === 4 ? directoryCount : 0, true)
  view.setUint32(44, fatCount, true); view.setUint32(48, directory, true)
  view.setUint32(56, 4096, true); view.setUint32(60, miniCount ? miniFat : end, true)
  view.setUint32(64, miniCount, true); view.setUint32(68, difatCount ? fatCount : end, true)
  view.setUint32(72, difatCount, true)
  for (let i = 0; i < 109; i++) view.setUint32(76 + i * 4, i < fatCount ? i : free, true)
  for (let i = 0; i < fatCount; i++) fat[i] = 0xfffffffd
  if (difatCount) {
    fat[fatCount] = 0xfffffffc
    for (let i = 0; i < size / 4 - 1; i++) {
      view.setUint32((fatCount + 1) * size + i * 4, i + 109 < fatCount ? i + 109 : free, true)
    }
    view.setUint32((fatCount + 2) * size - 4, end, true)
  }
  link(fat, directory, directoryCount)
  link(fat, miniFat, miniCount)
  link(fat, miniRoot, rootCount)

  // Each directory record has a distinct member identity; data uses both allocators.
  const directoryOffset = (directory + 1) * size
  for (let i = 0; i < directoryCount * size / 128; i++) {
    for (const field of [68, 72, 76]) view.setUint32(directoryOffset + i * 128 + field, free, true)
  }
  writeEntry(view, directoryOffset, 'Root Entry', 5, rootCount ? miniRoot : end, miniUnits * 64)
  view.setUint32(directoryOffset + 76, entries.length ? 1 : free, true)
  let nextMini = 0
  let nextRegular = regular
  for (let i = 0; i < entries.length; i++) {
    const [name, data] = entries[i]!
    const small = data.length < 4096
    const units = Math.ceil(data.length / (small ? 64 : size))
    const start = data.length ? (small ? nextMini : nextRegular) : end
    const record = directoryOffset + (i + 1) * 128
    writeEntry(view, record, name, 2, start, data.length)
    view.setUint32(record + 72, i + 1 < entries.length ? i + 2 : free, true)
    if (small) {
      link(miniature, nextMini, units)
      bytes.set(data, (miniRoot + 1) * size + nextMini * 64)
      nextMini += units
    } else {
      link(fat, nextRegular, units)
      bytes.set(data, (nextRegular + 1) * size)
      nextRegular += units
    }
  }
  for (let i = 0; i < fat.length; i++) view.setUint32(size + i * 4, fat[i]!, true)
  for (let i = 0; i < miniature.length; i++) view.setUint32((miniFat + 1) * size + i * 4, miniature[i]!, true)
  return bytes
}

/**
 * Finds one record in a synthetic vector for focused corruption tests.
 * @param bytes - Fixture bytes.
 * @param name - Exact directory name.
 * @returns Record byte offset.
 */
export function fixtureEntry(bytes: Uint8Array, name: string): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const size = 2 ** view.getUint16(30, true)
  const base = (view.getUint32(48, true) + 1) * size
  for (let offset = base; offset < base + size; offset += 128) {
    const length = view.getUint16(offset + 64, true)
    let actual = ''
    for (let i = 0; i < length - 2; i += 2) actual += String.fromCharCode(view.getUint16(offset + i, true))
    if (actual === name) return offset
  }
  throw new Error(`Fixture entry absent: ${name}`)
}

/**
 * Links a contiguous run in an independently built allocation table.
 * @param table - Allocation words.
 * @param start - First unit.
 * @param count - Number of units.
 */
function link(table: Uint32Array, start: number, count: number): void {
  for (let i = 0; i < count; i++) table[start + i] = i + 1 === count ? end : start + i + 1
}

/**
 * Writes the required directory fields without importing production code.
 * @param view - Fixture byte writer.
 * @param offset - Record offset.
 * @param name - Entry name.
 * @param type - Root or stream tag.
 * @param start - Initial allocation unit.
 * @param size - Meaningful byte count.
 */
function writeEntry(view: DataView, offset: number, name: string, type: number, start: number, size: number): void {
  for (let i = 0; i < name.length; i++) view.setUint16(offset + i * 2, name.charCodeAt(i), true)
  view.setUint16(offset + 64, (name.length + 1) * 2, true)
  view.setUint8(offset + 66, type); view.setUint8(offset + 67, 1)
  view.setUint32(offset + 116, start, true); view.setUint32(offset + 120, size, true)
}
