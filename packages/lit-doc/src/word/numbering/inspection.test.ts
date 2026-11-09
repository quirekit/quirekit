import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { operation as op, withPiecePropertyGroup, withStyleDefinitions } from '../../testing/formatting'
import { numberingRecordsFixture } from '../../testing/numbering'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'

/**
 * Joins independently authored global records to a synthetic paragraph source.
 * @param direct - Direct paragraph operations, after inherited source references.
 * @param piece - Optional final piece operations, after PAPX.
 * @returns Complete original bytes with a nine-level instance and a child style.
 */
function document(direct: number[], piece?: number[]): Uint8Array {
  let streams = withStyleDefinitions(withParagraphRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
    cuts: [2048, 2050], records: [{ style: 15, bytes: direct, odd: direct.length % 2 === 1 }],
  }]), [{ index: 0, properties: [...op(0x460b, 1, 0), ...op(0x260a, 2)] }, { index: 15, parent: 0 }])
  if (piece) streams = withPiecePropertyGroup(streams, piece, 0)
  const { table, header } = numberingRecordsFixture({ multi: true })
  const original = streams['1Table']!
  const joined = new Uint8Array(original.length + table.length)
  joined.set(original); joined.set(table, original.length)
  const word = streams.WordDocument!.slice()
  const fib = new DataView(word.buffer)
  for (const index of [73, 74]) {
    fib.setUint32(154 + index * 8, original.length + header.records[index]!.offset, true)
    fib.setUint32(158 + index * 8, header.records[index]!.length, true)
  }
  return compoundFixture({ ...streams, WordDocument: word, '1Table': joined })
}

describe('opt-in source numbering inspection', () => {
  it('retains the active zero of a separate immutable native Word producer', () => {
    const bytes = readFileSync(new URL('../../testing/fixtures/word-mac-zero-start/numbered-zero-start.doc', import.meta.url))
    expect(bytes.byteLength).toBe(25_600)
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('d4ff6512fbaf27f2fab05a6f8afe796c4045a3e0523b046f29be04b15f1abeb1')
    const source = inspectDoc(bytes, { includeNumbering: true })
    expect(source.text).toBe('编号甲 Alpha\r编号乙 中文\r编号丙 Gamma\r')
    const reference = source.paragraphs![0]!.numbering!
    const instance = source.numbering!.instances[reference.instanceIndex! - 1]!
    const definition = source.numbering!.definitions[instance.definitionIndex]!
    expect(definition.levels[0]!.startAt).toBe(0)
    expect(source.paragraphs!.map(value => value.numbering?.instanceIndex)).toEqual([1, 1, 1])
  })

  it('uses inherited references, direct overrides and ending-piece changes in order', () => {
    const bytes = document([...op(0x460b, 0, 0), ...op(0x260a, 4)], [...op(0x460b, 0xff, 0xff), ...op(0x260a, 5)])
    const before = bytes.slice()
    const result = inspectDoc(bytes, { includeNumbering: true })
    expect(result.numbering?.definitions).toHaveLength(1)
    expect(result.paragraphs?.[0]?.numbering).toEqual({ rawIndex: 0xffff, rawLevel: 5,
      instanceIndex: 1, level: 5, keepLogicalIndentation: true })
    expect(result.paragraphs?.[0]?.baseFormat?.unsupportedOpcodes).toEqual([0x260a, 0x460b])
    expect(result.diagnostics.map(item => item.code)).toContain('numbering-formatting-unresolved')
    expect(bytes).toEqual(before)
    const plain = inspectDoc(bytes, { includeParagraphFormatting: true })
    expect(plain.numbering).toBeUndefined()
    expect(plain.paragraphs?.[0]?.numbering).toBeUndefined()
    expect(plain.paragraphs?.[0]?.baseFormat).toEqual(result.paragraphs?.[0]?.baseFormat)
  })

  it('retains explicit cancellation and ignores an inactive level', () => {
    expect(inspectDoc(document([...op(0x460b, 0, 0), ...op(0x260a, 255)]), { includeNumbering: true })
      .paragraphs?.[0]?.numbering).toMatchObject({ rawIndex: 0, rawLevel: 255, instanceIndex: null, level: null })
  })

  it('rejects invalid active references only in the requested source scope', () => {
    const bytes = document(op(0x460b, 2, 0))
    expect(inspectDoc(bytes, { includeParagraphFormatting: true }).paragraphs).toHaveLength(1)
    expect(() => inspectDoc(bytes, { includeNumbering: true })).toThrow(expect.objectContaining({ code: 'invalid-numbering-data' }))
  })

  it('validates the opt-in flag and each new caller ceiling before reading source bytes', () => {
    const bytes = document([])
    expect(() => inspectDoc(bytes, { includeNumbering: 'yes' } as never))
      .toThrow(expect.objectContaining({ code: 'invalid-input' }))
    for (const name of ['maxNumberingDefinitions', 'maxNumberingInstances', 'maxNumberingLevels', 'maxNumberingTextCodeUnits']) {
      expect(() => inspectDoc(bytes, { includeNumbering: true, limits: { [name]: 0 } }))
        .toThrow(expect.objectContaining({ code: 'invalid-input' }))
    }
  })

  it('matches fixed Word-authored decimal source facts without deriving marker text', () => {
    const bytes = readFileSync(new URL('../../testing/fixtures/word-mac-numbering/numbered-basic.doc', import.meta.url))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('b27b8f9a18ff39d33b2d13dcf47d4592b7fb09b61d5733758fa5e296c9ac4601')
    const source = inspectDoc(bytes, { includeNumbering: true })
    expect(source.text).toBe('编号甲 Alpha\r编号乙 中文\r编号丙 Gamma\r')
    expect(source.paragraphs?.map(paragraph => [paragraph.start, paragraph.end, paragraph.numbering?.instanceIndex, paragraph.numbering?.level]))
      .toEqual([[0, 10, 1, 0], [10, 17, 1, 0], [17, 27, 1, 0]])
    expect(source.numbering?.definitions).toHaveLength(1)
    expect(source.numbering?.definitions[0]?.levels).toHaveLength(9)
    expect(source.numbering?.definitions[0]?.levels[0]).toMatchObject({ index: 0, startAt: 1, numberFormat: 0,
      alignment: 0, suffix: 0, template: '\u0000.', placeholderOffsets: [1],
      paragraphProperties: Uint8Array.from([15, 132, 184, 1, 17, 132, 72, 254, 94, 132, 184, 1, 96, 132, 72, 254]) })
    expect(source.numbering?.instances[0]?.overrides).toEqual([])
  })
})
