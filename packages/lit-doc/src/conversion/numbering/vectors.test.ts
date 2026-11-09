import { readFileSync } from 'node:fs'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { describe, expect, it } from 'vitest'
import { numberingRecordsFixture } from '../../testing/numbering'
import { operation as op } from '../../testing/formatting'
import type { ParagraphNumberingState } from '../../word/numbering/types'
import { readConversionSource } from '../source/read'
import { createProjectionContext } from '../xml/context'
import { numberingFormat } from './format'
import { projectNumbering } from './projection'
import { numberingReference } from './references'

const native = new Uint8Array(readFileSync(new URL('../../testing/fixtures/word-mac-numbering/numbered-basic.doc', import.meta.url)))

/** @returns Bounded XML/report owner independent of the source-list fixture. */
function xml() {
  return createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 27, paragraphs: 3, characterRuns: 3, tables: 0, styles: 1, fonts: 1, sections: 1 })
}

/** @param root - Typed Word XML. @param name - Local name. @returns All matching elements. */
function find(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : find(child, name))]
}

/** @param node - Typed XML element. @param name - Local attribute. @returns Exact value. */
function attr(node: DocxXmlElementPlan, name = 'val') { return node.attributes.find(item => item.localName === name)?.value }

/**
 * Combines an actual source interpreter context with independently encoded list bytes.
 * @param fixture - Raw numbering vector; source locators refer to this standalone table.
 * @returns Complete optional graph and its diagnostic owner.
 */
function project(fixture: ReturnType<typeof numberingRecordsFixture>) {
  const source = readConversionSource(native, {})
  source.table = fixture.table; source.header = fixture.header
  const context = xml()
  return { graph: projectNumbering(source, context), context, source }
}

describe('normative DOC numbering tuples', () => {
  it.each([[0, 'decimal'], [40, 'decimal'], [41, 'koreanDigital'], [44, 'koreanDigital2'], [45, 'hebrew1'],
    [49, 'hindiVowels'], [56, 'vietnameseCounting'], [57, 'numberInDash'], [58, 'russianLower'], [59, 'russianUpper'], [255, 'none']] as const)
  ('maps source format %i without the historical shifted table', (code, expected) => expect(numberingFormat(code)).toBe(expected))

  it.each([8, 9, 15, 19, 60, 254])('refuses unknown/reserved format %i without a decimal fallback', code => {
    expect(() => numberingFormat(code)).toThrow(expect.objectContaining({ code: 'unsupported-numbering' }))
  })

  it('replaces a declared UTF-16 offset after a surrogate pair without consuming author text', () => {
    const { graph } = project(numberingRecordsFixture({ template: '😀 \u0000.', placeholder: 4 }))
    expect(attr(find(graph.root!, 'lvlText')[0]!)).toBe('😀 %1.')
  })

  it.each([false, true])('activates a full replacement start only when fStartAt is %s', activate => {
    const fixture = numberingRecordsFixture({ overrideLevel: 0, overrideStart: -1 })
    const table = new Uint8Array(fixture.table.length + 34)
    table.set(fixture.table); table.set(fixture.table.subarray(30, 64), fixture.table.length)
    const view = new DataView(table.buffer)
    view.setUint32(fixture.header.records[74]!.offset + 28, activate ? 0x30 : 0x20, true)
    view.setInt32(fixture.table.length, 0, true)
    const records = fixture.header.records.map((range, index) => index === 74 ? { ...range, length: range.length + 34 } : range)
    const { graph } = project({ table, header: { ...fixture.header, records } })
    const override = find(graph.root!, 'lvlOverride')[0]!
    expect(find(override, 'startOverride').map(node => attr(node))).toEqual(activate ? ['0'] : [])
    expect(attr(find(find(override, 'lvl')[0]!, 'start')[0]!)).toBe('0')
  })

  it('preserves a zero start-only override on its actual level', () => {
    const { graph } = project(numberingRecordsFixture({ multi: true, overrideLevel: 5, overrideStart: 0 }))
    const override = find(graph.root!, 'lvlOverride')[0]!
    expect(attr(override, 'ilvl')).toBe('5')
    expect(find(override, 'lvl')).toEqual([])
    expect(attr(find(override, 'startOverride')[0]!)).toBe('0')
  })

  it('preserves explicit never restart, legal numbering, suffix and alignment as one source tuple', () => {
    const fixture = numberingRecordsFixture()
    fixture.table[35] = 2 | 4 | 8; fixture.table[45] = 2; fixture.table[56] = 0
    const { graph } = project(fixture)
    expect(attr(find(graph.root!, 'lvlRestart')[0]!)).toBe('0')
    expect(find(graph.root!, 'isLgl')).toHaveLength(1)
    expect(attr(find(graph.root!, 'suff')[0]!)).toBe('nothing')
    expect(attr(find(graph.root!, 'lvlJc')[0]!)).toBe('right')
  })

  it('keeps a bullet PUA unit without projecting its ignored negative start', () => {
    const { graph } = project(numberingRecordsFixture({ format: 23, template: '\uf0b7', placeholder: 0, start: -1 }))
    expect(find(graph.root!, 'start')).toEqual([])
    expect(attr(find(graph.root!, 'lvlText')[0]!)).toBe('\uf0b7')
  })

  it('uses the shared paragraph and character interpreters for marker-level properties', () => {
    const { graph } = project(numberingRecordsFixture({ paragraphProperties: [...op(0x840f, 0xd0, 2), ...op(0x8411, 0x98, 0xfe)],
      characterProperties: [...op(0x0835, 1), ...op(0x4a43, 28, 0)] }))
    expect(find(graph.root!, 'ind')[0]!.attributes.map(value => [value.localName, value.value])).toEqual([['left', '720'], ['hanging', '360']])
    expect(attr(find(graph.root!, 'b')[0]!)).toBe('1')
    expect(attr(find(graph.root!, 'sz')[0]!)).toBe('28')
  })

  it('keeps relative marker inheritance and diagnoses an unrepresentable inverse', () => {
    const { graph, context } = project(numberingRecordsFixture({ characterProperties: [...op(0x0835, 0x80), ...op(0x0836, 0x81)] }))
    expect(find(graph.root!, 'b')).toEqual([]); expect(find(graph.root!, 'i')).toEqual([])
    expect(context.report.diagnostics.some(value => value.code === 'numbering-inverse-toggle-unprojected' && value.kind === 'loss')).toBe(true)
  })

  it('refuses a literal percent-number ambiguity atomically', () => {
    const { graph, context } = project(numberingRecordsFixture({ template: '%1 literal', placeholder: 0 }))
    expect(graph.root).toBeNull(); expect(graph.handled).toBe(false)
    expect(graph.paragraph(0)).toEqual([]); expect(graph.style(0)).toEqual([])
    expect(context.report.diagnostics.some(value => value.code === 'numbering-graph-unprojected')).toBe(true)
  })

  it('does not claim level properties were retained when a later graph validation refuses them', () => {
    const { graph, context } = project(numberingRecordsFixture({ template: '%1 literal', placeholder: 0,
      characterProperties: op(0x0835, 1) }))
    expect(graph.root).toBeNull()
    expect(context.report.diagnostics.map(value => value.code)).toEqual(['numbering-graph-unprojected'])
  })

  it('retains two concrete identities sharing the same abstract definition', () => {
    const fixture = numberingRecordsFixture()
    const at = fixture.header.records[74]!.offset
    const table = new Uint8Array(fixture.table.length + 20), view = new DataView(table.buffer)
    table.set(fixture.table.subarray(0, at))
    view.setUint32(at, 2, true)
    table.set(fixture.table.subarray(at + 4, at + 20), at + 4)
    table.set(fixture.table.subarray(at + 4, at + 20), at + 20)
    view.setUint32(at + 36, 0xffffffff, true); view.setUint32(at + 40, 0xffffffff, true)
    const records = fixture.header.records.map((range, index) => index === 74 ? { ...range, length: 44 } : range)
    const source = readConversionSource(native, {})
    source.table = table; source.header = { ...fixture.header, records }
    source.paragraphNumbering = [1, 2, 1].map(rawIndex => ({ rawIndex, rawLevel: 0, referenceChanged: true }))
    const context = xml(), graph = projectNumbering(source, context)
    expect(find(graph.root!, 'abstractNum')).toHaveLength(1)
    expect(find(graph.root!, 'num').map(node => attr(node, 'numId'))).toEqual(['1', '2'])
    expect(find(graph.root!, 'abstractNumId').map(node => attr(node))).toEqual(['0', '0'])
    expect(context.report.diagnostics.some(value => value.code === 'numbering-shared-counter-host-limit')).toBe(true)
  })

  it('retains local ilvl writes even before an instance is assigned, and never duplicates inheritance', () => {
    const cases: [ParagraphNumberingState, string[], string[]][] = [
      [{ rawIndex: 1, rawLevel: 3 }, [], []],
      [{ rawIndex: 0, rawLevel: 3, levelChanged: true }, ['3'], []],
      [{ rawIndex: 1, rawLevel: 3, referenceChanged: true }, [], ['1']],
      [{ rawIndex: 0xf801, rawLevel: 3, referenceChanged: true }, [], ['0']],
      [{ rawIndex: 1, rawLevel: 12, levelChanged: true }, [], ['0']],
    ]
    for (const [state, levels, instances] of cases) {
      const roots = numberingReference(state, xml())
      expect(roots.flatMap(root => find(root, 'ilvl').map(node => attr(node)))).toEqual(levels)
      expect(roots.flatMap(root => find(root, 'numId').map(node => attr(node)))).toEqual(instances)
    }
  })
})
