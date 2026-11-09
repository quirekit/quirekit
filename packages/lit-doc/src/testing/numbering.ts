import type { WordHeader } from '../word/types'

/**
 * Builds independently authored binary records using the published Word field widths.
 * @param options - Minimal source variations for semantic and boundary vectors.
 * @returns Table stream and counted FIB locators, without a candidate-produced expected value.
 */
export function numberingRecordsFixture(options: { multi?: boolean; format?: number; template?: string; start?: number;
  placeholder?: number; overrideLevel?: number; overrideStart?: number; linkedId?: number;
  paragraphProperties?: readonly number[]; characterProperties?: readonly number[] } = {}) {
  const template = options.template ?? '\u0000.'
  const count = options.multi ? 9 : 1
  const paragraph = options.paragraphProperties ?? [], character = options.characterProperties ?? []
  const levelSize = 28 + paragraph.length + character.length + 2 + template.length * 2
  const instanceAt = 30 + count * levelSize
  const instanceSize = options.overrideLevel === undefined ? 24 : 32
  const table = new Uint8Array(instanceAt + instanceSize)
  const view = new DataView(table.buffer)
  view.setInt16(0, 1, true)
  view.setInt32(2, 101, true)
  view.setUint32(6, 7, true)
  for (let index = 0; index < 9; index++) view.setUint16(10 + index * 2, 0x0fff, true)
  table[28] = options.multi ? 0 : 1
  for (let index = 0; index < count; index++) {
    const at = 30 + index * levelSize
    view.setInt32(at, options.start ?? 1, true)
    table[at + 4] = options.format ?? 0
    table[at + 6] = options.placeholder ?? 1
    table[at + 24] = character.length; table[at + 25] = paragraph.length
    table.set(paragraph, at + 28); table.set(character, at + 28 + paragraph.length)
    const textAt = at + 28 + paragraph.length + character.length
    view.setUint16(textAt, template.length, true)
    for (let unit = 0; unit < template.length; unit++) view.setUint16(textAt + 2 + unit * 2, template.charCodeAt(unit), true)
  }
  view.setUint32(instanceAt, 1, true)
  view.setInt32(instanceAt + 4, options.linkedId ?? 101, true)
  table[instanceAt + 16] = options.overrideLevel === undefined ? 0 : 1
  view.setUint32(instanceAt + 20, 0xffffffff, true)
  if (options.overrideLevel !== undefined) {
    view.setInt32(instanceAt + 24, options.overrideStart ?? 0, true)
    view.setUint32(instanceAt + 28, options.overrideLevel | 0x10, true)
  }
  const records = Array.from({ length: 93 }, () => ({ offset: 0, length: 0 }))
  records[73] = { offset: 0, length: 30 }
  records[74] = { offset: instanceAt, length: instanceSize }
  const header: WordHeader = { version: 0xc1, tableStream: '0Table', meaningfulBytes: 1024, headerLength: 900,
    records,
    stories: [{ kind: 'main', start: 0, end: 27 }], textLength: 27, diagnostics: [] }
  return { table, header }
}

/**
 * Appends independently encoded numbering vectors to complete source streams.
 * @param streams - Existing Word streams, retained unchanged.
 * @param fixture - Standalone list bytes and their independent FIB locators.
 * @returns Repacked streams whose list locators point at the appended bytes.
 */
export function withNumberingRecords(streams: Record<string, Uint8Array>, fixture: ReturnType<typeof numberingRecordsFixture>): Record<string, Uint8Array> {
  const name = streams['1Table'] ? '1Table' : '0Table'
  const previous = streams[name]!
  const table = new Uint8Array(previous.length + fixture.table.length)
  table.set(previous); table.set(fixture.table, previous.length)
  const word = streams.WordDocument!.slice(), fib = new DataView(word.buffer)
  for (const index of [73, 74]) {
    const range = fixture.header.records[index]!
    fib.setUint32(154 + index * 8, previous.length + range.offset, true)
    fib.setUint32(158 + index * 8, range.length, true)
  }
  return { ...streams, WordDocument: word, [name]: table }
}
