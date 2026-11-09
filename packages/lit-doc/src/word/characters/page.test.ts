import { describe, expect, it } from 'vitest'
import { withCharacterRecords } from '../../testing/characters'
import { wordStreams } from '../../testing/word'
import { readCharacterPage } from './page'

describe('character source pages', () => {
  it('reads absent and explicitly empty records without interpreting page metadata as properties', () => {
    const streams = withCharacterRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{
      cuts: [2048, 2049, 2050], records: [undefined, []],
    }])
    const page = streams.WordDocument!.subarray(4096, 4608)
    expect(readCharacterPage(page).map(record => record.properties.length)).toEqual([0, 0])
  })

  it.each(['count', 'order', 'pointer', 'length'] as const)('rejects malformed %s', kind => {
    const streams = withCharacterRecords(wordStreams([{ units: [65, 13], unicode: false }]), [{ cuts: [2048, 2050], records: [[]] }])
    const page = streams.WordDocument!.slice(4096, 4608)
    if (kind === 'count') page[511] = 102
    if (kind === 'order') new DataView(page.buffer).setUint32(4, 2048, true)
    if (kind === 'pointer') page[8] = 1
    if (kind === 'length') page[300] = 255
    expect(() => readCharacterPage(page)).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })
})
