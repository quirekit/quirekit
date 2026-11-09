import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { fieldDocument } from '../../testing/fields/conversion'
import { operation } from '../../testing/formatting'
import { tableDocument } from '../../testing/tables/document'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed XML tree. @param name - Target element. @returns Ordered descendants including the root. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param element - Typed element. @param name - Attribute name. @returns Exact stored value. */
function attribute(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }
/** @param text - Original source. @param options - Source fixture controls. @returns Actual public source-to-OOXML result. */
function convert(text: string, options: Parameters<typeof fieldDocument>[1] = {}) {
  return createDocxSourcePlan(fieldDocument(text, options), { lossPolicy: 'best-effort' })
}

const text = 'A\u0013 PAGE \u00141\u0015Z\r'
const tokens = [{ position: 1, code: 19, value: 33 }, { position: 8, code: 20, value: 255 }, { position: 10, code: 21, value: 0x90 }]

it.each([false, true])('preserves markers, exact instructions and cached formatting with locked=%s', locked => {
  const { plan, report } = convert(text, { tables: [{ kind: 'main', tokens: [...tokens.slice(0, 2), { ...tokens[2]!, value: locked ? 0x90 : 0x80 }] }],
    characters: [{ start: 1, end: 2, operations: operation(0x0855, 1) }, { start: 2, end: 8, operations: operation(0x0835, 1) },
      { start: 8, end: 9, operations: operation(0x0855, 1) }, { start: 9, end: 10, operations: operation(0x0836, 1) },
      { start: 10, end: 11, operations: operation(0x0855, 1) }] })
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'fldChar').map(node => attribute(node, 'fldCharType'))).toEqual(['begin', 'separate', 'end'])
  expect(attribute(nodes(root, 'fldChar')[0]!, 'fldLock')).toBe(locked ? '1' : '0')
  expect(nodes(root, 'instrText').map(node => node.children)).toEqual([[' PAGE ']])
  expect(nodes(root, 't').flatMap(node => node.children).join('')).toBe('A1Z')
  const instruction = nodes(root, 'r').find(run => nodes(run, 'instrText').length)!
  const cached = nodes(root, 'r').find(run => nodes(run, 't').some(node => node.children.includes('1')))!
  expect(nodes(instruction, 'b')).toHaveLength(1)
  expect(nodes(cached, 'i')).toHaveLength(1)
  expect(report.diagnostics.some(item => item.code === 'field-unprojected' || item.code === 'special-unprojected' || item.source === 'fib:16')).toBe(false)
})

it('keeps an absent result and code whitespace without synthesizing source flags', () => {
  const { plan, report } = convert('\u0013PRIVATE\t x\u0015\r')
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'instrText').flatMap(node => node.children).join('')).toBe('PRIVATE\t x')
  expect(nodes(root, 'fldChar').map(node => attribute(node, 'fldCharType'))).toEqual(['begin', 'end'])
  expect(attribute(nodes(root, 'fldChar')[0]!, 'fldLock')).toBeUndefined()
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'field-index-absent', kind: 'compatibility' }))
})

it('uses instruction carriers while any ancestor is in code, preserving the child cached result separately', () => {
  const { plan } = convert('\u0013A\u0013B\u00141\u0015\u00142\u0015\r', { tables: [{ kind: 'main', tokens: [
    { position: 0, code: 19, value: 7 }, { position: 2, code: 19, value: 8 }, { position: 4, code: 20, value: 255 },
    { position: 6, code: 21, value: 0xc0 }, { position: 7, code: 20, value: 255 }, { position: 9, code: 21, value: 0x80 },
  ] }] })
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'instrText').flatMap(node => node.children)).toEqual(['A', 'B', '1'])
  expect(nodes(root, 't').flatMap(node => node.children)).toEqual(['2'])
  expect(nodes(root, 'fldChar').map(node => attribute(node, 'fldCharType'))).toEqual(['begin', 'begin', 'separate', 'end', 'separate', 'end'])
})

it('retains cross-paragraph results and their empty paragraph without flattening the flow', () => {
  const { plan } = convert('\u0013QUOTE\u0014first\r\rLast\u0015\r')
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'p')).toHaveLength(3)
  expect(nodes(root, 't').flatMap(node => node.children)).toEqual(['first', 'Last'])
  expect(nodes(root, 'fldChar').map(node => attribute(node, 'fldCharType'))).toEqual(['begin', 'separate', 'end'])
})

it('keeps DOC edit/format flags distinct from OOXML dirty and diagnoses unprojected state', () => {
  const { plan, report } = convert(text, { tables: [{ kind: 'main', tokens: [...tokens.slice(0, 2), { ...tokens[2]!, value: 0x8d }] }] })
  expect(nodes(plan.parts[0]!.root!, 'fldChar').some(node => attribute(node, 'dirty') !== undefined)).toBe(false)
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'field-state-unprojected', kind: 'loss' }))
})

it('omits private cached results during recovery and retains explicit strict refusal', () => {
  const bytes = fieldDocument(text, { tables: [{ kind: 'main', tokens: [...tokens.slice(0, 2), { ...tokens[2]!, value: 0xa0 }] }] })
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' }))
    .toThrow(expect.objectContaining({ code: 'unsupported-field' }))
  const { plan, report } = createDocxSourcePlan(bytes)
  expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children).join('')).toBe('AZ')
  expect(report.recovery?.cause).toBe('unsupported-field')
})

it('keeps a separator-free private field without inventing a visible cached result', () => {
  const { plan, report } = convert('\u0013 PAGE \u0015\r', { tables: [{ kind: 'main', tokens: [
    { position: 0, code: 19, value: 33 }, { position: 7, code: 21, value: 0x20 },
  ] }] })
  expect(nodes(plan.parts[0]!.root!, 'fldChar').map(node => attribute(node, 'fldCharType'))).toEqual(['begin', 'end'])
  expect(nodes(plan.parts[0]!.root!, 't')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'field-private-state-unprojected', kind: 'loss' }))
})

it('keeps a private empty separated result while reporting its unmapped state', () => {
  const { plan, report } = convert('A\u0013 PAGE \u0014\u0015Z\r', { tables: [{ kind: 'main', tokens: [
    { position: 1, code: 19, value: 33 }, { position: 8, code: 20, value: 255 }, { position: 9, code: 21, value: 0xa0 },
  ] }] })
  expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children).join('')).toBe('AZ')
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'field-private-state-unprojected', kind: 'loss' }))
})

it('keeps resource-field display content under its existing owner and preserves ordinary result children', () => {
  const { plan, report } = convert('A\u0013EMBED\u0014B\u0013DATE\u0014C\u0015D\u0015Z\r')
  const root = plan.parts[0]!.root!
  expect(nodes(root, 'fldChar').map(node => attribute(node, 'fldCharType'))).toEqual(['begin', 'separate', 'end'])
  expect(nodes(root, 'instrText').flatMap(node => node.children)).toEqual(['DATE'])
  expect(nodes(root, 't').flatMap(node => node.children).join('')).toBe('ABCDZ')
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'field-resource-unprojected', kind: 'loss' }))
})

it('does not leak child markers from a resource field instruction', () => {
  const { plan } = convert('\u0013EMBED \u0013DATE\u00141\u0015\u0014Shown\u0015\r')
  expect(nodes(plan.parts[0]!.root!, 'fldChar')).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 'instrText')).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children)).toEqual(['Shown'])
})

it('does not splice an unsupported resource child cache into an ordinary ancestor instruction', () => {
  const { plan } = convert('\u0013IF \u0013EMBED\u00141\u0015 = 1\u0014yes\u0015\r')
  expect(nodes(plan.parts[0]!.root!, 'instrText').flatMap(node => node.children)).toEqual(['IF ', ' = 1'])
  expect(nodes(plan.parts[0]!.root!, 't').flatMap(node => node.children)).toEqual(['yes'])
})

it('recognizes resource ownership after long whitespace without matching an author keyword prefix', () => {
  const resource = convert(`\u0013${' '.repeat(70)}EMBED\u0014Shown\u0015\r`)
  expect(nodes(resource.plan.parts[0]!.root!, 'fldChar')).toEqual([])
  const ordinary = convert('\u0013EMBEDIT\u0014Shown\u0015\r')
  const shapePrefix = convert('\u0013SHAPEX\u0014Shown\u0015\r')
  expect(nodes(shapePrefix.plan.parts[0]!.root!, 'fldChar')).toHaveLength(3)
  expect(nodes(ordinary.plan.parts[0]!.root!, 'fldChar')).toHaveLength(3)
})

it.each(['\u0014x\r', '\u0013x\u0014\u0014y\u0015\r', '\u0013x\r'])('diagnoses recovery of malformed raw topology %j', content => {
  expect(() => createDocxSourcePlan(fieldDocument(content), { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-field-data' }))
  expect(convert(content).report.recovery?.cause).toBe('invalid-field-data')
})

it('recovers cached text after cross-paragraph instructions and cross-cell pairing', () => {
  const recovered = convert('\u0013QUOTE\rinstruction\u0014result\u0015\r')
  expect(nodes(recovered.plan.parts[0]!.root!, 't').flatMap(node => node.children)).toEqual(['result'])
  expect(recovered.report.recovery?.cause).toBe('unsupported-field')
  const bytes = tableDocument([{ texts: ['\u0013PAGE\u00141', 'two\u0015'], edges: [0, 1000, 2000] }])
  expect(createDocxSourcePlan(bytes).report.recovery?.cause).toBe('unsupported-field')
  expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'unsupported-field' }))
})

it('enforces field counts and depth even when the source omits all field indexes', () => {
  for (const [content, limits] of [['\u0013A\u0015\u0013B\u0015\r', { maxFields: 1 }],
    ['\u0013A\u0013B\u0015\u0015\r', { maxFieldDepth: 1 }]] as const)
    expect(() => createDocxSourcePlan(fieldDocument(content), { lossPolicy: 'best-effort', limits }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
