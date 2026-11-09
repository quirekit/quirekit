import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { noteDocumentStreams } from '../../testing/notes'
import { operation } from '../../testing/formatting'
import { numberingRecordsFixture, withNumberingRecords } from '../../testing/numbering'
import { tableDefinition } from '../../testing/tables/definition'
import { bitmapRecord, inlinePicture } from '../../testing/pictures/records'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed XML tree. @param name - Element local name. @returns Source-ordered matches. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param node - Typed XML element. @param name - Attribute name. @returns Stored value. */
function attribute(node: DocxXmlElementPlan, name: string) { return node.attributes.find(value => value.localName === name)?.value }

it('connects independent note families to actual parts with formatted content, empty paragraphs and exact ids', () => {
  const streams = noteDocumentStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002 Foot\r\rTail\r' }], [{ anchor: 3, text: '\u0002\tEnd\r' }], {
    characters: [{ start: 7, end: 11, operations: operation(0x0835, 1) }],
    paragraphs: [{ start: 5, end: 12, operations: operation(0x2403, 2) }],
  })
  const { plan, report } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  const body = plan.parts[0]!.root!
  expect(nodes(body, 'footnoteReference').map(node => attribute(node, 'id'))).toEqual(['1'])
  expect(nodes(body, 'endnoteReference').map(node => attribute(node, 'id'))).toEqual(['1'])
  for (const [kind, expected, paragraphs] of [['footnote', ' FootTail', 3], ['endnote', 'End', 1]] as const) {
    const part = plan.parts.find(part => part.name === `/word/${kind}s.xml`)!
    expect(part).toBeDefined()
    const note = nodes(part.root!, kind).find(node => attribute(node, 'id') === '1')!
    expect(nodes(note, 't').flatMap(node => node.children).join('')).toBe(expected)
    expect(nodes(note, 'p')).toHaveLength(paragraphs)
    expect(nodes(note, `${kind}Ref`)).toHaveLength(1)
    expect(plan.relationships.some(rel => rel.sourcePart === '/word/document.xml' && rel.target === part.name)).toBe(true)
    if (kind === 'footnote') {
      expect(nodes(note, 'b')).toHaveLength(1)
      expect(nodes(note, 'jc').map(node => attribute(node, 'val'))).toContain('right')
    }
  }
  expect(report.diagnostics.some(item => item.code === 'story-unprojected' && /footnote|endnote/u.test(item.source))).toBe(false)
  expect(report.diagnostics.some(item => item.code === 'object-anchor-unprojected')).toBe(false)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-separators-approximated', kind: 'approximation' }))
})

it('includes note-only lists in the shared numbering graph', () => {
  const streams = withNumberingRecords(noteDocumentStreams('A\u0002\r', [{ anchor: 1, text: '\u0002 Intro\rList\r' }], [], {
    paragraphs: [{ start: 11, end: 16, operations: [...operation(0x460b, 1, 0), ...operation(0x260a, 0)] }],
  }), numberingRecordsFixture({ start: 3 }))
  const { plan } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts.find(part => part.name === '/word/footnotes.xml')!.root!, 'numId').map(node => attribute(node, 'val'))).toEqual(['1'])
  expect(nodes(plan.parts.find(part => part.name === '/word/numbering.xml')!.root!, 'start').map(node => attribute(node, 'val'))).toEqual(['3'])
})

it('keeps a valid reference as an explicitly empty note after a content field failure', () => {
  const streams = noteDocumentStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002\u0013broken\r' }], [{ anchor: 3, text: '\u0002 Kept\r' }])
  const { plan, report } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  const foot = plan.parts.find(part => part.name === '/word/footnotes.xml')!.root!
  const end = plan.parts.find(part => part.name === '/word/endnotes.xml')!.root!
  expect(nodes(foot, 'footnote').find(node => attribute(node, 'id') === '1')!.children).toHaveLength(1)
  expect(nodes(foot, 't')).toEqual([])
  expect(nodes(end, 't').flatMap(node => node.children).join('')).toBe(' Kept')
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-content-unprojected', kind: 'loss' }))
})

it('omits instruction-only note references without installing orphaned parts', () => {
  const streams = noteDocumentStreams('A\u0013\u0002hidden\u0014Shown\u0015\r', [{ anchor: 2, text: '\u0002 Note\r' }])
  const { plan, report } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  expect(plan.parts.some(part => part.name === '/word/footnotes.xml')).toBe(false)
  const settings = plan.parts.find(part => part.name === '/word/settings.xml')
  expect(settings ? nodes(settings.root!, 'footnotePr') : []).toHaveLength(0)
  expect(nodes(plan.parts[0]!.root!, 'footnoteReference')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-reference-unprojected', kind: 'loss', start: 2 }))
})

it('refuses invalid automatic controls and custom markers explicitly', () => {
  const streams = noteDocumentStreams('A\u0002B*\r', [{ anchor: 1, text: '\u0002 Auto\r' }], [{ anchor: 3, text: '* Custom\r', referenceValue: 0 }], {
    characters: [{ start: 1, end: 2, operations: [] }],
  })
  const { plan, report } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  expect(plan.parts.some(part => /\/(footnotes|endnotes)\.xml$/u.test(part.name))).toBe(false)
  expect(report.diagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'note-reference-unprojected', kind: 'loss' }),
    expect.objectContaining({ code: 'note-custom-marker-unprojected', kind: 'loss' }),
  ]))
})

it('enforces combined main, footnote and endnote paragraph and run allocations', () => {
  const bytes = compoundFixture(noteDocumentStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002 Foot\r' }], [{ anchor: 3, text: '\u0002 End\r' }]))
  for (const limits of [{ maxParagraphs: 4 }, { maxCharacterRuns: 10 }, { maxNotes: 1 }]) {
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  }
})

it('preserves note tables and rejects a shared table budget across independent note stories', () => {
  const text = '\u0002 Intro\rCell\u0007\u0007\r'
  const main = 'A\u0002B\u0002\r'
  const footStart = main.length
  const endStart = footStart + text.length + 1
  const member = [...operation(0x2416, 1), ...operation(0x6649, 1, 0, 0, 0)]
  const paragraphs = [footStart, endStart].flatMap(start => [
    { start: start + 8, end: start + 13, operations: member },
    { start: start + 13, end: start + 14, operations: [...member, ...operation(0x2417, 1), ...tableDefinition([0, 2400])] },
  ])
  const bytes = compoundFixture(noteDocumentStreams(main, [{ anchor: 1, text }], [{ anchor: 3, text }], { paragraphs }))
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  for (const kind of ['footnote', 'endnote']) {
    const root = plan.parts.find(part => part.name === `/word/${kind}s.xml`)!.root!
    expect(nodes(root, 'tbl')).toHaveLength(1)
    expect(nodes(root, 'tc')).toHaveLength(1)
    expect(nodes(root, 'gridCol').map(node => attribute(node, 'w'))).toEqual(['2400'])
    expect(nodes(root, 't').flatMap(node => node.children).join('')).toBe(' IntroCell')
  }
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxTables: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('retains paragraph allocations consumed by a failed note formatting scope', () => {
  const bytes = compoundFixture(noteDocumentStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002 Foot\r' }], [{ anchor: 3, text: '\u0002 End\r' }], {
    paragraphs: [{ start: 5, end: 12, operations: operation(0x2403, 255) }],
  }))
  const { report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(report.diagnostics.some(item => item.code === 'note-source-unprojected')).toBe(true)
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxParagraphs: 4 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('requires the source self marker authority and keeps directory failures explicit', () => {
  const source = noteDocumentStreams('A\u0002\r', [{ anchor: 1, text: '\u0002 Note\r' }], [], {
    characters: [{ start: 3, end: 4, operations: [] }],
  })
  const { plan, report } = createDocxSourcePlan(compoundFixture(source), { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts.find(part => part.name === '/word/footnotes.xml')!.root!, 't')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-content-unprojected', kind: 'loss' }))
  const broken = noteDocumentStreams('A\u0002\r', [{ anchor: 1, text: '\u0002 Note\r' }])
  new DataView(broken.WordDocument!.buffer).setUint32(158 + 2 * 8, 9, true)
  const bytes = compoundFixture(broken)
  expect(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' }).report.diagnostics)
    .toContainEqual(expect.objectContaining({ code: 'note-directory-unprojected', kind: 'loss' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
})

it('commits only successful note media while retaining global decoding and drawing allocations', () => {
  const main = 'A\u0002B\u0002\r', foot = '\u0002 \u0001\u0013broken\r', end = '\u0002 \u0001\r'
  const endStart = main.length + foot.length + 1
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)
  const operations = [...operation(0x0855, 1), ...operation(0x6a03, 0, 0, 0, 0)]
  const bytes = compoundFixture({ ...noteDocumentStreams(main, [{ anchor: 1, text: foot }], [{ anchor: 3, text: end }], {
    characters: [{ start: main.length + 2, end: main.length + 3, operations }, { start: endStart + 2, end: endStart + 3, operations }],
  }), Data: inlinePicture([bitmapRecord(png)]) })
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(plan.resources).toHaveLength(1)
  const relationships = plan.relationships.filter(relation => relation.relationshipType.endsWith('/image'))
  expect(relationships).toHaveLength(1)
  expect(relationships[0]!.sourcePart).toBe('/word/endnotes.xml')
  expect(plan.parts.flatMap(part => nodes(part.root!, 'docPr')).map(node => attribute(node, 'id'))).toEqual(['2'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-resources-host-limit', kind: 'host-limit' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxPictures: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
