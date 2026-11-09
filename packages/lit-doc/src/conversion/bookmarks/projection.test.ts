import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { expect, it } from 'vitest'
import { fieldDocument } from '../../testing/fields/conversion'
import { operation } from '../../testing/formatting'
import { tableDefinition } from '../../testing/tables/definition'
import type { BookmarkTableFixture } from '../../testing/bookmarks/types'
import { createDocxSourcePlan } from '../plan'

/** @param root - Actual typed subtree. @param name - Element discriminator. @returns Ordered descendant elements. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}
/** @param element - Typed source element. @param name - Target attribute. @returns Actual projected attribute. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }
/** @param text - Authored raw source. @param bookmarks - Independent table facts. @param options - Original character/table properties. @returns Actual public projection. */
function convert(text: string, bookmarks: BookmarkTableFixture, options: Parameters<typeof fieldDocument>[1] = {}) {
  return createDocxSourcePlan(fieldDocument(text, { ...options, bookmarks }), { lossPolicy: 'best-effort' })
}

it('splits formatted runs at crossing bookmark boundaries and emits paragraph siblings', () => {
  const { plan, report } = convert('ABCDEFGH\r', { entries: [
    { name: 'Long', start: 1, endIndex: 0 }, { name: 'Cross', start: 2, endIndex: 1 },
  ], ends: [5, 7] }, { characters: [{ start: 0, end: 9, operations: operation(0x0835, 1) }] })
  const paragraph = nodes(plan.parts[0]!.root!, 'p')[0]!
  expect(paragraph.children.filter(child => typeof child !== 'string').map(child => child.localName))
    .toEqual(['pPr', 'r', 'bookmarkStart', 'r', 'bookmarkStart', 'r', 'bookmarkEnd', 'r', 'bookmarkEnd', 'r'])
  expect(nodes(paragraph, 't').flatMap(node => node.children)).toEqual(['A', 'B', 'CDE', 'FG', 'H'])
  expect(nodes(paragraph, 'r').every(run => nodes(run, 'b').length === 1)).toBe(true)
  expect(nodes(paragraph, 'bookmarkStart').map(node => [attr(node, 'id'), attr(node, 'name')])).toEqual([['0', 'Long'], ['1', 'Cross']])
  expect(report.diagnostics.some(item => ['fib:21', 'fib:22', 'fib:23'].includes(item.source))).toBe(false)
})

it('emits old endings before new starts and keeps empty pairs adjacent at the same CP', () => {
  const { plan } = convert('ABCD\r', { entries: [
    { name: 'First', start: 0, endIndex: 0 }, { name: 'Empty', start: 2, endIndex: 1 },
    { name: 'Next', start: 2, endIndex: 2 },
  ], ends: [2, 2, 4] })
  const markers = nodes(plan.parts[0]!.root!, 'p')[0]!.children.filter(child => typeof child !== 'string' && child.localName.startsWith('bookmark')) as DocxXmlElementPlan[]
  expect(markers.map(node => [node.localName, attr(node, 'id')])).toEqual([
    ['bookmarkStart', '0'], ['bookmarkEnd', '0'], ['bookmarkStart', '1'], ['bookmarkEnd', '1'], ['bookmarkStart', '2'], ['bookmarkEnd', '2'],
  ])
})

it('projects equivalent aliased endpoints as separate named pairs with a bookmark compatibility diagnostic', () => {
  const entries = [{ name: 'First', start: 1, endIndex: 0 }, { name: 'Second', start: 1, endIndex: 0 }]
  const aliased = convert('ABCD\r', { entries, ends: [3, 3] })
  const unique = convert('ABCD\r', { entries: [entries[0]!, { ...entries[1]!, endIndex: 1 }], ends: [3, 3] })
  expect(aliased.plan).toEqual(unique.plan)
  expect(nodes(aliased.plan.parts[0]!.root!, 'bookmarkStart').map(node => [attr(node, 'id'), attr(node, 'name')]))
    .toEqual([['0', 'First'], ['1', 'Second']])
  expect(aliased.report.diagnostics).toContainEqual(expect.objectContaining({
    code: 'bookmark-equivalent-end-index', kind: 'compatibility', source: 'bookmarks',
  }))
  expect(aliased.report.lossy).toBe(unique.report.lossy)
})

it('keeps cross-paragraph ranges and empty-paragraph anchors at their source boundaries', () => {
  const { plan } = convert('A\r\rB\r', { entries: [
    { name: 'Across', start: 0, endIndex: 1 }, { name: 'EmptyParagraph', start: 2, endIndex: 0 },
  ], ends: [2, 4] })
  const paragraphs = nodes(plan.parts[0]!.root!, 'p')
  expect(paragraphs).toHaveLength(3)
  expect(nodes(paragraphs[1]!, 'bookmarkStart').map(node => attr(node, 'name'))).toEqual(['EmptyParagraph'])
  expect(nodes(paragraphs[2]!, 'bookmarkEnd').map(node => attr(node, 'id'))).toEqual(['0'])
})

it('preserves column attributes and reports the separate export hint without inventing columns', () => {
  const { plan, report } = convert('ABCD\r', { entries: [
    { name: 'Columns', start: 0, endIndex: 0, rawFlags: 0x8301 },
    { name: 'Ordinary', start: 1, endIndex: 1, rawFlags: 0x7fff },
  ], ends: [3, 4] })
  const starts = nodes(plan.parts[0]!.root!, 'bookmarkStart')
  expect([attr(starts[0]!, 'colFirst'), attr(starts[0]!, 'colLast')]).toEqual(['1', '2'])
  expect(attr(starts[1]!, 'colFirst')).toBeUndefined()
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'bookmark-export-hint-unprojected', kind: 'loss' }))
})

it('keeps a range around a complete table and drops both markers when a row-only endpoint has no paragraph carrier', () => {
  const member = [...operation(0x2416, 1), ...operation(0x6649, 1, 0, 0, 0)]
  const { plan, report } = convert('A\rCell\u0007\u0007Z\r', { entries: [
    { name: 'TableRange', start: 0, endIndex: 1 }, { name: 'RowOnly', start: 1, endIndex: 0 },
  ], ends: [7, 9] }, { paragraphs: [
    { start: 2, end: 7, operations: member },
    { start: 7, end: 8, operations: [...member, ...operation(0x2417, 1), ...tableDefinition([0, 1000], [{ flags: 0, width: 1000 }])] },
  ] })
  expect(nodes(plan.parts[0]!.root!, 'tbl')).toHaveLength(1)
  expect(nodes(plan.parts[0]!.root!, 'bookmarkStart').map(node => attr(node, 'name'))).toEqual(['TableRange'])
  expect(nodes(plan.parts[0]!.root!, 'bookmarkEnd').map(node => attr(node, 'id'))).toEqual(['0'])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'bookmark-boundary-unprojected', kind: 'loss' }))
})

it.each([
  ['A😀BC\r', { entries: [{ name: 'Split', start: 0, endIndex: 0 }], ends: [2] }, 'bookmark-surrogate-boundary-unprojected'],
  ['A\u0013 PAGE \u00141\u0015Z\r', { entries: [{ name: 'Code', start: 0, endIndex: 0 }], ends: [4] }, 'bookmark-instruction-unprojected'],
  ['AB\r', { entries: [{ name: '_GoBack', start: 0, endIndex: 0 }], ends: [1] }, 'bookmark-navigation-marker-omitted'],
])('omits the whole pair for an unadmitted endpoint: %s', (text, bookmarks, code) => {
  const { plan, report } = convert(text as string, bookmarks as BookmarkTableFixture)
  expect(nodes(plan.parts[0]!.root!, 'bookmarkStart')).toEqual([])
  expect(nodes(plan.parts[0]!.root!, 'bookmarkEnd')).toEqual([])
  expect(report.diagnostics).toContainEqual(expect.objectContaining({ code }))
})
