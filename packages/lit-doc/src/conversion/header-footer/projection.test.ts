import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { compoundFixture } from '../../testing/compound'
import { headerDocumentStreams } from '../../testing/header-footer'
import { numberingRecordsFixture, withNumberingRecords } from '../../testing/numbering'
import { operation } from '../../testing/formatting'
import { bitmapRecord, inlinePicture } from '../../testing/pictures/records'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed XML root. @param name - Element local name. @returns All matching descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param element - XML element. @param name - Attribute local name. @returns Complete attribute value. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(value => value.localName === name)?.value }

it('projects independent six-slot stories, parity and title-page switches with complete relationships', () => {
  const streams = headerDocumentStreams([['Even\r\r', 'Odd\r\r', 'EF\r\r', 'OF\r\r', 'First\r\r', 'FF\r\r']],
    { evenAndOdd: true, titlePages: [true] })
  const { plan, report } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  const parts = plan.parts.filter(part => /\/(header|footer)\d+\.xml$/u.test(part.name))
  expect(parts).toHaveLength(6)
  expect(parts.map(part => nodes(part.root!, 't').flatMap(node => node.children).join(''))).toEqual(['Even', 'Odd', 'EF', 'OF', 'First', 'FF'])
  expect(parts.every(part => nodes(part.root!, 'p').length === 1 && nodes(part.root!, 'sectPr').length === 0)).toBe(true)
  const section = nodes(plan.parts[0]!.root!, 'sectPr')[0]!
  expect(nodes(section, 'headerReference').map(node => attr(node, 'type'))).toEqual(['even', 'default', 'first'])
  expect(nodes(section, 'footerReference').map(node => attr(node, 'type'))).toEqual(['even', 'default', 'first'])
  expect(nodes(section, 'titlePg')).toHaveLength(1)
  expect(nodes(plan.parts.find(part => part.name === '/word/settings.xml')!.root!, 'evenAndOddHeaders')).toHaveLength(1)
  for (const part of parts) expect(plan.relationships.some(relationship => relationship.sourcePart === '/word/document.xml' && relationship.target === part.name)).toBe(true)
  expect(report.diagnostics.some(item => item.code === 'story-unprojected' && item.source === 'story:header')).toBe(false)
  expect(report.diagnostics.some(item => item.code === 'note-separators-unprojected')).toBe(true)
})

it('preserves explicit blank overrides, independent identical text and inherited absent slots', () => {
  const { plan } = createDocxSourcePlan(compoundFixture(headerDocumentStreams([
    ['', 'Same\r\r', '', 'Footer\r\r', '', ''],
    ['', '', '', '\r\r', 'Same\r\r', ''],
  ])), { lossPolicy: 'best-effort' })
  const sections = nodes(plan.parts[0]!.root!, 'sectPr')
  expect(sections).toHaveLength(2)
  expect(nodes(sections[1]!, 'headerReference').map(node => attr(node, 'type'))).toEqual(['first'])
  expect(nodes(sections[1]!, 'footerReference').map(node => attr(node, 'type'))).toEqual(['default'])
  const headers = plan.parts.filter(part => /\/header\d+\.xml$/u.test(part.name))
  expect(headers).toHaveLength(2)
  expect(headers.map(part => nodes(part.root!, 't').flatMap(node => node.children).join(''))).toEqual(['Same', 'Same'])
  const blank = plan.parts.filter(part => /\/footer\d+\.xml$/u.test(part.name))[1]!.root!
  expect(nodes(blank, 'p')).toHaveLength(1)
  expect(nodes(blank, 't')).toEqual([])
  expect(nodes(sections[1]!, 'titlePg').map(node => attr(node, 'val'))).not.toContain('1')
})

it('isolates an invalid field story using an explicit blank part while retaining the next story', () => {
  const { plan, report } = createDocxSourcePlan(compoundFixture(headerDocumentStreams([
    ['', 'Broken\u0013instruction\r\r', '', 'Kept\r\r', '', ''],
  ])), { lossPolicy: 'best-effort' })
  const header = plan.parts.find(part => /\/header\d+\.xml$/u.test(part.name))!.root!
  const footer = plan.parts.find(part => /\/footer\d+\.xml$/u.test(part.name))!.root!
  expect(nodes(header, 't')).toEqual([])
  expect(nodes(header, 'p')).toHaveLength(1)
  expect(nodes(footer, 't').flatMap(node => node.children).join('')).toBe('Kept')
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'header-footer-content-unprojected', kind: 'loss', start: 14, end: 34 }))
})

it('shares image bytes across source parts while allocating distinct relationships and document-wide drawing IDs', () => {
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)
  const operations = [...operation(0x0855, 1), ...operation(0x6a03, 0, 0, 0, 0)]
  const streams = { ...headerDocumentStreams([['', '\u0001\r\r', '', '\u0001\r\r', '', '']],
    { characters: [{ start: 14, end: 15, operations }, { start: 17, end: 18, operations }] }), Data: inlinePicture([bitmapRecord(png)]) }
  const bytes = compoundFixture(streams)
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(plan.resources).toHaveLength(1)
  const imageRelations = plan.relationships.filter(relationship => relationship.relationshipType.endsWith('/image'))
  expect(imageRelations).toHaveLength(2)
  expect(new Set(imageRelations.map(relationship => relationship.sourcePart)).size).toBe(2)
  expect(new Set(imageRelations.map(relationship => relationship.key)).size).toBe(2)
  expect(new Set(imageRelations.map(relationship => relationship.target)).size).toBe(1)
  expect(plan.parts.flatMap(part => nodes(part.root!, 'docPr')).map(node => attr(node, 'id'))).toEqual(['1', '2'])
  for (const limits of [{ maxPictures: 1 }, { maxTotalPictureBytes: png.length }, { maxParagraphs: 5 }, { maxCharacterRuns: 2 }])
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('projects list references used only inside a header into the shared document numbering graph', () => {
  const streams = withNumberingRecords(headerDocumentStreams([['', 'List\r\r', '', '', '', '']], {
    paragraphs: [{ start: 14, end: 19, operations: [...operation(0x460b, 1, 0), ...operation(0x260a, 0)] }],
  }), numberingRecordsFixture({ start: 3 }))
  const { plan } = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  const header = plan.parts.find(part => /\/header\d+\.xml$/u.test(part.name))!.root!
  expect(nodes(header, 'numId').map(node => attr(node, 'val'))).toEqual(['1'])
  expect(nodes(plan.parts[0]!.root!, 'numId')).toEqual([])
  const numbering = plan.parts.find(part => part.name === '/word/numbering.xml')!.root!
  expect(nodes(numbering, 'start').map(node => attr(node, 'val'))).toEqual(['3'])
})

it('discards failed story media registrations while retaining spent global occurrence budgets', () => {
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)
  const operations = [...operation(0x0855, 1), ...operation(0x6a03, 0, 0, 0, 0)]
  const header = '\u0001\u0013bad\r\r'
  const footerStart = 14 + header.length
  const bytes = compoundFixture({ ...headerDocumentStreams([['', header, '', '\u0001\r\r', '', '']], {
    characters: [{ start: 14, end: 15, operations }, { start: footerStart, end: footerStart + 1, operations }],
  }), Data: inlinePicture([bitmapRecord(png)]) })
  const { plan } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  const relationships = plan.relationships.filter(relationship => relationship.relationshipType.endsWith('/image'))
  expect(relationships).toHaveLength(1)
  expect(relationships[0]!.sourcePart).toContain('/footer')
  expect(plan.resources).toHaveLength(1)
  expect(plan.parts.flatMap(part => nodes(part.root!, 'docPr')).map(node => attr(node, 'id'))).toEqual(['2'])
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxPictures: 1 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-field-data' }))
})

it('keeps verified main text when optional header directory validation fails and refuses it in strict mode', () => {
  const streams = headerDocumentStreams([['', 'Header\r\r', '', '', '', '']])
  new DataView(streams.WordDocument!.buffer).setUint32(158 + 11 * 8, 52, true)
  const bytes = compoundFixture(streams)
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children).join('')).toBe('A')
  expect(plan.parts.filter(part => /\/(header|footer)\d+\.xml$/u.test(part.name))).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'header-footer-directory-unprojected', kind: 'loss' }))
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-story-data' }))
})
