import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { compoundFixture } from '../../testing/compound'
import { noteDocumentStreams } from '../../testing/notes'
import { withNoteSettings } from '../../testing/notes/settings'
import { operation } from '../../testing/formatting'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed XML root. @param name - Local name. @returns All matching descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param element - Property group. @returns Actual scalar values keyed by child name. */
function values(element: DocxXmlElementPlan | undefined): Record<string, unknown> {
  return Object.fromEntries((element?.children ?? []).flatMap(child => typeof child === 'string' ? []
    : [[child.localName, child.attributes.find(attribute => attribute.localName === 'val')?.value]]))
}

/** @returns Independent source DOP with nondefault numbering and locations. */
function dop(): Uint8Array {
  const bytes = new Uint8Array(500)
  const view = new DataView(bytes.buffer)
  view.setUint8(0, 1 | 2 << 5)
  view.setUint16(2, 7 << 2 | 1, true)
  view.setUint16(52, 9 << 2, true)
  view.setUint16(54, 0, true)
  view.setUint16(492, 3, true)
  view.setUint16(494, 9, true)
  return bytes
}

/** @param version - Effective source version. @param operations - Actual section overrides. @param settings - Source DOP. @returns Public conversion plan. */
function convert(version: 0xc1 | 0x101, operations: readonly number[] = [], settings = dop()) {
  const source = noteDocumentStreams('A\u0002B\u0002\r', [{ anchor: 1, text: '\u0002 Foot\r' }], [{ anchor: 3, text: '\u0002 End\r' }])
  return createDocxSourcePlan(compoundFixture(withNoteSettings(source, version, settings, operations)), { lossPolicy: 'best-effort' })
}

it('merges legacy document note settings with parity under a single settings part and relationship', () => {
  const { plan, report } = convert(0xc1)
  const parts = plan.parts.filter(part => part.name === '/word/settings.xml')
  expect(parts).toHaveLength(1)
  expect(plan.relationships.filter(relationship => relationship.target === '/word/settings.xml')).toHaveLength(1)
  expect(values(nodes(parts[0]!.root!, 'footnotePr')[0])).toMatchObject({ pos: 'beneathText', numFmt: 'upperLetter', numStart: '7', numRestart: 'eachSect' })
  expect(values(nodes(parts[0]!.root!, 'endnotePr')[0])).toMatchObject({ pos: 'sectEnd', numFmt: 'chicago', numStart: '9', numRestart: 'continuous' })
  expect(nodes(parts[0]!.root!, 'evenAndOddHeaders')).toHaveLength(1)
  expect(report.diagnostics.some(item => item.code === 'note-properties-unprojected')).toBe(false)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-settings-host-limit', kind: 'host-limit' }))
})

it('uses explicit modern defaults and preserves section zero, format and placement overrides', () => {
  const { plan } = convert(0x101, [...operation(0x5040, 4, 0), ...operation(0x503f, 0, 0),
    ...operation(0x303b, 2), ...operation(0x5042, 1, 0), ...operation(0x5041, 6, 0), ...operation(0x3012, 0)])
  const settings = plan.parts.find(part => part.name === '/word/settings.xml')!.root!
  expect(values(nodes(settings, 'footnotePr')[0])).toMatchObject({ pos: 'pageBottom', numFmt: 'decimal', numStart: '1', numRestart: 'continuous' })
  expect(values(nodes(settings, 'endnotePr')[0])).toMatchObject({ pos: 'sectEnd', numFmt: 'lowerRoman', numStart: '1', numRestart: 'continuous' })
  const section = nodes(plan.parts[0]!.root!, 'sectPr')[0]!
  expect(values(nodes(section, 'footnotePr')[0])).toEqual({ numFmt: 'lowerLetter', numStart: '0', pos: 'beneathText' })
  expect(values(nodes(section, 'endnotePr')[0])).toEqual({ numFmt: 'upperRoman', numStart: '6' })
  expect(nodes(section, 'noEndnote')[0]?.attributes).toContainEqual(expect.objectContaining({ localName: 'val', value: '1' }))
})

it('omits a source offset ignored by noncontinuous numbering while retaining the restart', () => {
  const { plan, report } = convert(0x101, [...operation(0x303c, 2), ...operation(0x503f, 7, 0)])
  const section = nodes(plan.parts[0]!.root!, 'sectPr')[0]!
  expect(values(nodes(section, 'footnotePr')[0])).toEqual({ numRestart: 'eachPage' })
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'ignored-note-offset', kind: 'compatibility' }))
})

it('retains explicit false endnote suppression and refuses unknown formats without a decimal replacement', () => {
  const { plan, report } = convert(0x101, [...operation(0x3012, 1), ...operation(0x5040, 60, 0)])
  const section = nodes(plan.parts[0]!.root!, 'sectPr')[0]!
  expect(nodes(section, 'noEndnote')[0]?.attributes).toContainEqual(expect.objectContaining({ localName: 'val', value: '0' }))
  expect(nodes(section, 'footnotePr')).toHaveLength(0)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-settings-unprojected', kind: 'loss' }))
  expect(plan.parts.some(part => part.name === '/word/footnotes.xml')).toBe(true)
})

it.each([{ code: 8, name: 'hex' }, { code: 9, name: 'chicago' }, { code: 15, name: 'decimalHalfWidth' }, { code: 19, name: 'decimalFullWidth2' }])
  ('preserves valid note format $name separately from list-level reserved values', ({ code, name }) => {
    const settings = dop()
    new DataView(settings.buffer).setUint16(492, code, true)
    const { plan } = convert(0xc1, [], settings)
    const root = plan.parts.find(part => part.name === '/word/settings.xml')!.root!
    expect(values(nodes(root, 'footnotePr')[0]).numFmt).toBe(name)
  })

it('diagnoses absent and refused document settings while retaining connected note content', () => {
  const missing = convert(0x101, [], new Uint8Array())
  expect(missing.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-document-settings-missing', kind: 'approximation' }))
  const invalid = dop()
  invalid[54] = 1
  const refused = convert(0x101, [], invalid)
  expect(refused.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'note-settings-unprojected', kind: 'loss' }))
  expect(refused.plan.parts.filter(part => /\/(footnotes|endnotes)\.xml$/u.test(part.name))).toHaveLength(2)
})
