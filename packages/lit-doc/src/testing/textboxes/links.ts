import { artRecord, pictureBytes, pictureProperties } from '../pictures/records'
import { drawingShape } from '../drawings/streams'
import { operation } from '../formatting'
import { fieldDocument } from '../fields/conversion'
import type { TextboxLinkVector } from './types'

/** @param options - Independently authored graph and storage variations. @returns Real binary DOC with one author interval and separately anchored linked frames. */
export function linkedTextboxDocument(options: TextboxLinkVector = {}): Uint8Array {
  const frames = options.frames ?? [{ shapeId: 1026, textId: 65536, nextShapeId: 1027 }, { shapeId: 1027, textId: 65537, nextShapeId: 0 }]
  const order = options.order ?? frames.map((_, index) => index), separator = options.separator ?? ''
  const body = order.map(() => '\u0008').join(separator) + '\r', positions: number[] = []
  for (let cp = 0; cp < body.length; cp++) if (body.charCodeAt(cp) === 8) positions.push(cp)
  const author = options.author, content = author?.text ?? 'One author story.\rSecond paragraph.\r'
  const count = author?.duplicateOwner ? 2 : 1, text = body + (content + '\r').repeat(count) + '\r\r'
  const shapes = frames.map(frame => {
    const fsp = new Uint8Array(8), view = new DataView(fsp.buffer)
    view.setUint32(0, frame.shapeId, true); view.setUint32(4, 0xa00, true)
    const client = new Uint8Array(4); new DataView(client.buffer).setUint32(0, frame.textId, true)
    return artRecord(0xf004, 0, 15, pictureBytes(artRecord(0xf00a, 202, 2, fsp),
      pictureProperties([[128, frame.textId], [138, frame.nextShapeId], ...(frame.properties ?? [])]),
      artRecord(0xf00d, 0, 0, client), artRecord(0xf010, 0, 0, new Uint8Array(4)), artRecord(0xf011, 0, 0, new Uint8Array(4))))
  })
  const drawing = pictureBytes(artRecord(0xf000, 0, 15, new Uint8Array()), Uint8Array.of(0),
    artRecord(0xf002, 0, 15, artRecord(0xf003, 0, 15, pictureBytes(drawingShape(1024, true), ...shapes))))
  const anchors = new Uint8Array(4 + order.length * 30), a = new DataView(anchors.buffer)
  order.forEach((frameIndex, index) => {
    a.setUint32(index * 4, positions[index]!, true); a.setUint32((index + 1) * 4, 0xffffffff, true)
    const at = (order.length + 1) * 4 + index * 26
    a.setUint32(at, frames[frameIndex]!.shapeId, true)
    for (const [axis, value] of [frameIndex * 2400, 80, frameIndex * 2400 + 1800, 1280].entries()) a.setInt32(at + 4 + axis * 4, value, true)
    a.setUint16(at + 20, 0x54, true)
  })
  const cuts = [0, ...Array.from({ length: text.length }, (_, index) => index + 1).filter(end => text.charCodeAt(end - 1) === 13)]
  const entries = Array.from({ length: count }, (_, index) => ({ start: index * (content.length + 1), end: (index + 1) * (content.length + 1),
    data: [options.count ?? frames.length, 0] as const, reuseFlags: 0, destination: 0xffffffff, shapeId: options.owner ?? frames[0]!.shapeId, undoTextId: 0 }))
  return fieldDocument(text, { drawings: { content: drawing, main: anchors },
    storyLengths: [body.length, 0, 0, 0, 0, (content.length + 1) * count + 1, 0], ...(author?.data ? { data: author.data } : {}),
    characters: [...positions.map(start => ({ start, end: start + 1, operations: operation(0x0855, 1) })),
      ...(author?.characters ?? []).map(span => ({ ...span, start: body.length + span.start, end: body.length + span.end }))],
    paragraphs: cuts.slice(0, -1).map((start, index) => ({ start, end: cuts[index + 1]!, operations: [] })),
    textboxes: [{ kind: 'textbox', entries: [...entries, { start: count * (content.length + 1), end: text.length + 1,
      data: [0, 0], reuseFlags: 0, destination: 0, shapeId: 0, undoTextId: 0 }] }] })
}
