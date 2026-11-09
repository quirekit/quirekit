import { wordStreams } from '../word'

/**
 * Encodes independent header PLC vectors with explicit content/guard characters.
 * @param sections - Six stored header/footer strings per section in source order.
 * @param options - Source parity flag and preceding footnote storage.
 * @returns Complete root streams for compound-file and later formatting fixtures.
 */
export function headerFooterStreams(sections: readonly (readonly string[])[], options: {
  evenAndOdd?: boolean, footnoteText?: string,
} = {}): Record<string, Uint8Array> {
  if (!sections.length || sections.some(section => section.length !== 6)) throw new Error('Expected six header/footer slots per section')
  const main = sections.map((_, index) => String.fromCharCode(65 + index) + (index === sections.length - 1 ? '\r' : '\f')).join('')
  const footnotes = options.footnoteText ?? ''
  const stories = ['\u0003\r\r', '\u0004\r\r', '', '\u0003\r\r', '\u0004\r\r', '', ...sections.flat()]
  const headerText = stories.join('') + '\r'
  const streams = wordStreams([{ units: (main + footnotes + headerText + '\r').split('').map(unit => unit.charCodeAt(0)), unicode: true }],
    { storyLengths: [main.length, footnotes.length, headerText.length, 0, 0, 0, 0] })
  const original = streams['1Table']!
  const plcLength = (stories.length + 2) * 4
  const sectionLength = 4 + sections.length * 16
  const table = new Uint8Array(original.length + plcLength + sectionLength + 12)
  table.set(original)
  const view = new DataView(table.buffer)
  let cp = 0
  stories.forEach((story, index) => {
    view.setUint32(original.length + index * 4, cp, true)
    cp += story.length
  })
  view.setUint32(original.length + stories.length * 4, cp, true)
  view.setUint32(original.length + (stories.length + 1) * 4, 0xffffffff, true)
  const sectionOffset = original.length + plcLength
  for (let index = 0; index <= sections.length; index++) view.setUint32(sectionOffset + index * 4, index * 2, true)
  const settingsOffset = sectionOffset + sectionLength
  view.setUint8(settingsOffset, options.evenAndOdd ? 1 : 0)
  const fib = new DataView(streams.WordDocument!.buffer)
  for (const [index, offset, length] of [[11, original.length, plcLength], [6, sectionOffset, sectionLength], [31, settingsOffset, 12]]) {
    fib.setUint32(154 + index! * 8, offset!, true)
    fib.setUint32(158 + index! * 8, length!, true)
  }
  return { ...streams, '1Table': table }
}
