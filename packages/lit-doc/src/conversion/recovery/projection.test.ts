import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { fieldDocument } from '../../testing/fields/conversion'
import type { FieldDocumentOptions } from '../../testing/fields/types'
import { operation } from '../../testing/formatting'
import { createDocxSourcePlan } from '../plan'

/** @param text - Raw authored main/auxiliary text. @param options - Independent field and Story records. @returns Original file with an unsupported ordinary paragraph operation. */
function blocked(text: string, options: FieldDocumentOptions = {}): Uint8Array {
  return fieldDocument(text, { ...options, paragraphs: [{ start: 0, end: text.length, operations: operation(0x2408, 1) }] })
}

/** @param root - Actual typed XML. @param name - Element kind. @returns Descendants in document order. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param root - Actual typed document. @returns Recovered ordinary paragraph strings. */
function text(root: DocxXmlElementPlan): string[] {
  return nodes(root, 'p').map(paragraph => nodes(paragraph, 't').flatMap(element => element.children).join(''))
}

it('defaults to best effort and recovers validated body text with explicit unknown source counters', () => {
  const bytes = blocked('甲😀乙\rSecond\r'), before = bytes.slice()
  const { plan, report } = createDocxSourcePlan(bytes)
  expect(text(plan.parts[0]!.root!)).toEqual(['甲😀乙', 'Second'])
  expect(report).toMatchObject({ lossPolicy: 'best-effort', lossy: true,
    recovery: { level: 'text', cause: 'unsupported-formatting', unmeasuredSourceCounts: expect.arrayContaining(['tables', 'styles']) } })
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'document-text-recovered', kind: 'loss', source: 'document' }))
  expect(plan.resources).toEqual([])
  expect(bytes).toEqual(before)
})

it('keeps explicit strict failures and successful rich conversion distinct', () => {
  expect(() => createDocxSourcePlan(blocked('Body\r'), { lossPolicy: 'strict' }))
    .toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
  const normal = createDocxSourcePlan(fieldDocument('Body\r'))
  expect(normal.report.lossPolicy).toBe('best-effort')
  expect(normal.report.recovery).toBeUndefined()
})

it('keeps ordinary nested cached results and suppresses all field instructions', () => {
  const { plan } = createDocxSourcePlan(blocked('A\u0013 OUTER\u0014B\u0013 INNER\u0014C\u0015D\u0015E\r'))
  expect(text(plan.parts[0]!.root!)).toEqual(['ABCDE'])
})

it('suppresses indexed private results while retaining ordinary surrounding text', () => {
  const bytes = blocked('A\u0013 PRIVATE\u0014secret\u0015Z\r', { tables: [{ kind: 'main', tokens: [
    { position: 1, code: 19, value: 0 }, { position: 10, code: 20, value: 0 }, { position: 17, code: 21, value: 0xa0 },
  ] }] })
  const { plan, report } = createDocxSourcePlan(bytes)
  expect(text(plan.parts[0]!.root!)).toEqual(['AZ'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'text-recovery-private-result-omitted', kind: 'loss' }))
  expect(JSON.stringify(plan)).not.toContain('secret')
})

it('uses resolved source visibility after a late projection failure and marks early visibility gaps', () => {
  const source = fieldDocument('SHIDDENDELETEDINSERTED\u0013 X\u0014cache\u0015Z\r', {
    revisionAuthors: ['Author'], characters: [
      { start: 1, end: 7, operations: operation(0x083c, 1) },
      { start: 7, end: 14, operations: operation(0x0800, 1) },
      { start: 14, end: 22, operations: operation(0x0801, 1) },
    ], tables: [{ kind: 'main', tokens: [{ position: 22, code: 19, value: 0 },
      { position: 25, code: 20, value: 0 }, { position: 31, code: 21, value: 0xa0 }] }],
  })
  const known = createDocxSourcePlan(source)
  expect(text(known.plan.parts[0]!.root!)).toEqual(['SINSERTEDZ'])
  expect(known.report.recovery?.unresolvedTextSemantics).toEqual([])
  expect(createDocxSourcePlan(blocked('Body\r')).report.recovery?.unresolvedTextSemantics)
    .toEqual(['hidden-formatting', 'tracked-changes'])
})

it('suppresses cached fields when source state is unreadable and stops at ambiguous field tails', () => {
  const malformed = blocked('A\u0013 X\u0014secret\u0015Z\r', { tables: [{ kind: 'main', tokens: [
    { position: 1, code: 19, value: 0 }, { position: 5, code: 20, value: 0 },
  ] }] })
  expect(text(createDocxSourcePlan(malformed).plan.parts[0]!.root!)).toEqual(['AZ'])
  const ambiguous = createDocxSourcePlan(blocked('A\u0014uncertain\r'))
  expect(text(ambiguous.plan.parts[0]!.root!)).toEqual(['A'])
  expect(ambiguous.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'text-recovery-field-tail-omitted' }))
})

it('flattens table and section boundaries, keeps visible controls, and accounts for omitted objects and Stories', () => {
  const main = 'A\tB\u000bC\u001eD\u001f\u0007\u0007E\u000c\u0008F\u0002\r'
  const { plan, report } = createDocxSourcePlan(blocked(main + 'Header\r\r', { storyLengths: [main.length, 0, 7, 0, 0, 0, 0] }))
  expect(text(plan.parts[0]!.root!)).toEqual(['ABC\u2011D\u00ad', '', 'E', 'F'])
  expect(nodes(plan.parts[0]!.root!, 'tab')).toHaveLength(1)
  expect(nodes(plan.parts[0]!.root!, 'br')).toHaveLength(1)
  expect(JSON.stringify(plan)).not.toContain('Header')
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'text-recovery-object-omitted' }))
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'story-unprojected', source: 'story:header' }))
})

it.each([{ maxParagraphs: 1 }, { maxFields: 1 }, { maxFieldDepth: 1 }])('retains source ceilings during recovery %#', limits => {
  const input = blocked('A\r\u0013 OUTER\u0014\u0013 INNER\u0014B\u0015\u0015\r')
  expect(() => createDocxSourcePlan(input, { limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('charges recovered XML to the same output budget and keeps core and option errors explicit', () => {
  expect(() => createDocxSourcePlan(blocked('Body\r'), { outputLimits: { maxXmlNodes: 2 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  expect(() => createDocxSourcePlan(new Uint8Array(512))).toThrow(expect.objectContaining({ code: 'unsupported-container' }))
  expect(() => createDocxSourcePlan(blocked('Body\r'), { lossPolicy: 'invalid' as never }))
    .toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
