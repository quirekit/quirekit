import { describe, expect, it, vi } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { operation as op } from '../../testing/formatting'
import { pictureDocument } from '../../testing/pictures/document'
import { bitmapRecord, inlinePicture, pictureBytes } from '../../testing/pictures/records'
import { createDocxSourcePlan } from '../plan'
import { readConversionSource } from '../source/read'
import { createProjectionContext } from '../xml/context'
import { createPictureProjection } from './projection'

const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 0)
const picture = inlinePicture([bitmapRecord(png)])
const locator = [...op(0x0855, 1), ...op(0x6a03, 0, 0, 0, 0)]

/** @param root - Typed XML element. @param name - Local element name. @returns All matching descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

describe('main-story source picture projection', () => {
  it('shares media while retaining every occurrence and the original caller bytes', () => {
    const bytes = pictureDocument([{ text: 'A' }, { text: '\u0001', operations: locator }, { text: 'B' }, { text: '\u0001', operations: locator }], picture)
    const original = bytes.slice()
    const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    const root = plan.parts[0]!.root!
    expect(plan.resources).toHaveLength(1)
    expect(plan.resources[0]!.data).toEqual(png)
    expect(nodes(root, 'docPr').map(node => node.attributes.find(attribute => attribute.localName === 'id')!.value)).toEqual(['1', '2'])
    expect(nodes(root, 'blip').map(node => node.attributes[0])).toEqual(Array(2).fill({
      namespaceUri: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', prefix: 'r', localName: 'embed',
      value: { kind: 'relationship-reference', key: 'doc-picture-0' },
    }))
    expect(nodes(root, 't').flatMap(node => node.children).join('')).toBe('AB')
    expect(bytes).toEqual(original)
    expect(report.diagnostics.some(item => item.code === 'special-unprojected')).toBe(false)
  })

  it('preserves the picture locator across character style and plain resets', () => {
    for (const reset of [op(0x4a30, 15, 0), op(0x2a33, 0)]) {
      const bytes = pictureDocument([{ text: '\u0001', operations: [...locator, ...reset] }], picture)
      expect(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' }).plan.resources[0]!.data).toEqual(png)
    }
  })

  it('uses the final locator and isolates malformed optional pictures without dropping adjacent text', () => {
    const data = pictureBytes(new Uint8Array(8), picture)
    const bytes = pictureDocument([{ text: '\u0001', operations: [...locator, ...op(0x6a03, 8, 0, 0, 0)] },
      { text: 'kept\u0001', operations: locator }], data)
    const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    expect(plan.resources).toHaveLength(1)
    expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children).join('')).toBe('kept')
    expect(report.diagnostics.find(item => item.code === 'picture-unprojected')).toMatchObject({ start: 5, end: 6 })
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-picture-data' }))
  })

  it.each([0x0806, 0x080a, 0x0856])('keeps object role 0x%s outside the ordinary picture path', code => {
    const bytes = pictureDocument([{ text: '\u0001', operations: [...locator, ...op(code, 1), ...op(0x2a33, 0)] }], picture)
    const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    expect(plan.resources).toEqual([])
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'picture-unprojected', message: expect.stringContaining('embedded object') }))
  })

  it('omits instruction-only pictures and keeps all picture/output budget failures fatal', () => {
    const bytes = pictureDocument([{ text: '\u0013\u0001\u0014shown\u0015', operations: locator }], picture)
    expect(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' }).plan.resources).toEqual([])
    const repeated = pictureDocument([{ text: '\u0001\u0001', operations: locator }], picture)
    for (const limits of [{ maxPictures: 1 }, { maxPictureBytes: 1 }, { maxTotalPictureBytes: 1 }])
      expect(() => createDocxSourcePlan(repeated, { lossPolicy: 'best-effort', limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })

  it('bounds repeated media expansion while retaining one shared package resource', () => {
    const bytes = pictureDocument([{ text: '\u0001\u0001', operations: locator }], picture)
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxTotalPictureBytes: png.length } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
    expect(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', limits: { maxTotalPictureBytes: png.length * 2 } }).plan.resources).toHaveLength(1)
  })

  it('propagates unexpected failures instead of accepting a lossy success', () => {
    const source = readConversionSource(pictureDocument([{ text: '\u0001', operations: locator }], picture), {})
    const context = createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 2, paragraphs: 1, characterRuns: 2, tables: 0, styles: 0, fonts: 0, sections: 1 })
    vi.spyOn(source.context.reader, 'consume').mockImplementation(() => { throw new Error('unexpected failure') })
    expect(() => createPictureProjection(source, context).project(0, 0)).toThrow('unexpected failure')
  })
})
