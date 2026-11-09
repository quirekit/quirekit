import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { commentDocumentStreams } from '../../testing/comments/conversion'
import { operation } from '../../testing/formatting'
import { tableDefinition } from '../../testing/tables/definition'
import { bitmapRecord, inlinePicture } from '../../testing/pictures/records'
import { numberingRecordsFixture, withNumberingRecords } from '../../testing/numbering'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed actual XML. @param name - Element local name. @returns Ordered descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param node - Actual XML node. @param name - Attribute local name. @returns Stored attribute value. */
function attr(node: DocxXmlElementPlan, name: string) { return node.attributes.find(value => value.localName === name)?.value }

it('projects original point and reordered tag ranges, complete formatted bodies and source actors', () => {
  const streams = commentDocumentStreams('Before ABC\u0005 DEF\u0005 End\u0005\r', [
    { anchor: 10, text: 'Prefix \u0005First\r\rTail\r', initials: '一', bookmarkTag: 7 },
    { anchor: 15, text: 'Second\r', authorIndex: 1, initials: 'B', bookmarkTag: 8 },
    { anchor: 20, text: '\u0005Point\r' },
  ], { authors: ['作者', 'B'], bookmarks: [{ tag: 8, start: 7, endIndex: 1 }, { tag: 7, start: 8, endIndex: 0 }],
    ends: [10, 15], characters: [{ start: 30, end: 35, operations: operation(0x0835, 1) }],
    extras: [{ timestamp: 0x26d6b3ae }, { timestamp: 0 }, {}] })
  const { plan, report } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  const root = plan.parts.find(part => part.name === '/word/comments.xml')!.root!
  const messages = nodes(root, 'comment')
  expect(messages.map(message => [attr(message, 'id'), attr(message, 'author'), attr(message, 'initials'), attr(message, 'date')]))
    .toEqual([['0', '作者', '一', '2009-06-22T14:46:00'], ['1', 'B', 'B', undefined], ['2', '作者', '', undefined]])
  expect(messages.map(message => nodes(message, 't').flatMap(node => node.children).join(''))).toEqual(['Prefix FirstTail', 'Second', 'Point'])
  expect(messages.map(message => nodes(message, 'p').length)).toEqual([3, 1, 1])
  expect(messages.map(message => nodes(message, 'annotationRef').length)).toEqual([1, 0, 1])
  expect(nodes(root, 'b')).toHaveLength(1)
  expect(nodes(plan.parts[0]!.root!, 'commentRangeStart').map(node => attr(node, 'id'))).toEqual(['1', '0'])
  expect(nodes(plan.parts[0]!.root!, 'commentRangeEnd').map(node => attr(node, 'id'))).toEqual(['0', '1'])
  expect(nodes(plan.parts[0]!.root!, 'commentReference').map(node => attr(node, 'id'))).toEqual(['0', '1', '2'])
  expect(report.diagnostics.some(diagnostic => diagnostic.code === 'story-unprojected' && diagnostic.source === 'story:comment')).toBe(false)
  expect(report.diagnostics.some(diagnostic => diagnostic.code === 'object-anchor-unprojected')).toBe(false)
})

it('installs parent joins on final paragraphs and atomically omits threads with hidden references', () => {
  const bytes = compoundFixture(commentDocumentStreams('A\u0005B\u0013 CODE \u0005\u0014shown\u0015\u0005\r', [
    { anchor: 1, text: '\u0005Parent\rTail\r' }, { anchor: 10, text: '\u0005Hidden reply\r' }, { anchor: 18, text: '\u0005Kept root\r' },
  ], { extras: [{}, { depth: 1, parentDelta: -1 }, {}] }))
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const root = plan.parts.find(part => part.name === '/word/comments.xml')!.root!
  expect(nodes(root, 'comment').map(node => attr(node, 'id'))).toEqual(['2'])
  expect(nodes(plan.parts[0]!.root!, 'commentReference').map(node => attr(node, 'id'))).toEqual(['2'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'comment-thread-unprojected', kind: 'loss' }))
})

it('joins parents in either record direction and places identity on the final message paragraph', () => {
  const { plan, report } = createDocxSourcePlan(compoundFixture(commentDocumentStreams('A\u0005B\u0005\r', [
    { anchor: 1, text: '\u0005Reply\r' }, { anchor: 3, text: '\u0005Root\rTail\r' },
  ], { extras: [{ depth: 1, parentDelta: 1, flags: 0xfffffffd }, { flags: 2 }] })), { lossPolicy: 'best-effort' })
  const comments = plan.parts.find(part => part.name === '/word/comments.xml')!.root!
  expect(nodes(comments, 'comment').map(message => nodes(message, 'p').map(p => attr(p, 'paraId')))).toEqual([['00000001'], [undefined, '00000002']])
  const entries = nodes(plan.parts.find(part => part.name === '/word/commentsExtended.xml')!.root!, 'commentEx')
  expect(entries.map(entry => [attr(entry, 'paraId'), attr(entry, 'paraIdParent')])).toEqual([['00000001', '00000002'], ['00000002', undefined]])
  expect(report.diagnostics.some(diagnostic => diagnostic.code === 'comment-ink-unprojected')).toBe(true)
  expect(report.diagnostics.some(diagnostic => diagnostic.code === 'comment-extension-flags-unprojected')).toBe(false)
})

it.each([
  [0, undefined, false], [0x26d6b3ae, '2009-06-22T14:46:00', false],
  [(100 << 20) | (2 << 16) | (29 << 11) | (23 << 6) | 59, '2000-02-29T23:59:00', false],
  [(100 << 20) | (2 << 16) | (30 << 11), undefined, true],
  [(101 << 20) | (2 << 16) | (29 << 11), undefined, true],
  [0x26d6b3bf, undefined, true], [0x26d6b3ae & ~0xf0000, undefined, false],
])('keeps minute precision, ignored absence and invalid calendar losses separate: %s', (timestamp, date, loss) => {
  const { plan, report } = createDocxSourcePlan(compoundFixture(commentDocumentStreams('A\u0005\r', [{ anchor: 1, text: '\u0005Body\r' }],
    { extras: [{ timestamp: timestamp as number }] })), { lossPolicy: 'best-effort' })
  expect(attr(nodes(plan.parts.find(part => part.name === '/word/comments.xml')!.root!, 'comment')[0]!, 'date')).toBe(date)
  expect(report.diagnostics.some(diagnostic => diagnostic.code === 'comment-date-unprojected')).toBe(loss)
})

it('projects complete rich message tables and comment-only numbering with shared budgets', () => {
  const main = 'A\u0005\r', body = '\u0005 Intro\rList\rCell\u0007\u0007\r', start = main.length
  const member = [...operation(0x2416, 1), ...operation(0x6649, 1, 0, 0, 0)]
  const streams = withNumberingRecords(commentDocumentStreams(main, [{ anchor: 1, text: body }], { paragraphs: [
    { start: start + 8, end: start + 13, operations: [...operation(0x460b, 1, 0), ...operation(0x260a, 0)] },
    { start: start + 13, end: start + 18, operations: member },
    { start: start + 18, end: start + 19, operations: [...member, ...operation(0x2417, 1), ...tableDefinition([0, 2400])] },
  ] }), numberingRecordsFixture({ start: 3 }))
  const bytes = compoundFixture(streams), { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const root = plan.parts.find(part => part.name === '/word/comments.xml')!.root!
  expect(nodes(root, 'tbl')).toHaveLength(1)
  expect(nodes(root, 'numId').map(node => attr(node, 'val'))).toEqual(['1'])
  expect(nodes(plan.parts.find(part => part.name === '/word/numbering.xml')!.root!, 'start').map(node => attr(node, 'val'))).toEqual(['3'])
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxParagraphs: 2 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it.each([
  ['A😀B\u0005\r', 4, 0, 2, 'comment-surrogate-boundary-unprojected'],
  ['\u0013QUOTE\u0014A\u0005B\u0015\r', 8, 7, 9, 'comment-thread-unprojected'],
])('omits both range endpoints and references with unadmitted carriers: %s', (main, anchor, start, end, diagnostic) => {
  const { plan, report } = createDocxSourcePlan(compoundFixture(commentDocumentStreams(main as string,
    [{ anchor: anchor as number, text: '\u0005Body\r', bookmarkTag: 7 }], {
      bookmarks: [{ tag: 7, start: start as number, endIndex: 0 }], ends: [end as number],
    })), { lossPolicy: 'best-effort' })
  expect(plan.parts.some(part => part.name === '/word/comments.xml')).toBe(false)
  for (const marker of ['commentRangeStart', 'commentRangeEnd', 'commentReference']) expect(nodes(plan.parts[0]!.root!, marker)).toHaveLength(0)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: diagnostic }))
})

it('does not install media from refused messages while retaining consumed document work budgets', () => {
  const main = 'A\u0005B\u0005\r', broken = '\u0005 \u0001\u0013broken\r', kept = '\u0005 \u0001\r', next = main.length + broken.length
  const picture = [...operation(0x0855, 1), ...operation(0x6a03, 0, 0, 0, 0)]
  const bytes = compoundFixture({ ...commentDocumentStreams(main, [{ anchor: 1, text: broken }, { anchor: 3, text: kept }], {
    characters: [{ start: main.length + 2, end: main.length + 3, operations: picture }, { start: next + 2, end: next + 3, operations: picture }],
  }), Data: inlinePicture([bitmapRecord(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0))]) })
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(plan.resources).toHaveLength(1)
  const images = plan.relationships.filter(relationship => relationship.relationshipType.endsWith('/image'))
  expect(images).toHaveLength(1)
  expect(images[0]!.sourcePart).toBe('/word/comments.xml')
  expect(nodes(plan.parts.find(part => part.name === '/word/comments.xml')!.root!, 'docPr').map(node => attr(node, 'id'))).toEqual(['2'])
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxPictures: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
