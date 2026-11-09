import { describe, expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { operation as op } from '../../testing/formatting'
import { tableDocument } from '../../testing/tables/document'
import { createDocxSourcePlan } from '../plan'
import { readConversionSource } from '../source/read'
import { createProjectionContext } from '../xml/context'
import { projectSourceTable } from './projection'

/** @param root - Typed XML. @param name - Word local name. @returns Matching descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param node - Typed element. @param name - Stored attribute name. @returns Exact stored value. */
function attr(node: DocxXmlElementPlan, name = 'val') { return node.attributes.find(value => value.localName === name)?.value }

/** @param bytes - Actual DOC input. @returns Actual document part and complete report. */
function document(bytes: Uint8Array) {
  const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  return { root: plan.parts.find(part => part.name === '/word/document.xml')!.root!, report }
}

describe('complete source DOC table projection', () => {
  it('keeps common-grid spans, independent percentage preference and explicit row values in actual DOC XML', () => {
    const bytes = tableDocument([
      { texts: ['甲', 'B'], edges: [0, 1440, 2880], cells: [{ flags: 2 << 9, width: 2500 }],
        properties: [...op(0x3466, 0), ...op(0x3404, 0), ...op(0x9407, 0xd0, 0xfe)] },
      { texts: ['C', 'D', 'E'], edges: [0, 720, 1440, 2880] },
    ])
    const { root, report } = document(bytes)
    expect(report.diagnostics.some(value => value.code === 'table-geometry-unprojected')).toBe(false)
    expect(nodes(root, 'gridCol').map(node => attr(node, 'w'))).toEqual(['720', '720', '1440'])
    expect(nodes(root, 'gridSpan').map(node => attr(node))).toEqual(['2'])
    expect(nodes(root, 'tcW')[0]!.attributes.map(value => [value.localName, value.value])).toEqual([['w', '2500'], ['type', 'pct']])
    expect(nodes(root, 'trHeight')[0]!.attributes.map(value => [value.localName, value.value])).toEqual([['val', '304'], ['hRule', 'exact']])
    expect(nodes(root, 'cantSplit').map(node => attr(node))).toEqual(['0'])
    expect(nodes(root, 'tblHeader').map(node => attr(node))).toEqual(['0'])
    expect(nodes(root, 't').map(node => node.children.join('')).join('')).toBe('甲BCDE')
  })

  it('retains explicit horizontal and vertical continuation cells and their stored author content', () => {
    const { root } = document(tableDocument([
      { texts: ['A', 'hidden'], edges: [0, 1440, 2880], cells: [{ flags: 2 | 3 << 5, width: 0 }, { flags: 1, width: 0 }] },
      { texts: ['stored', 'B'], edges: [0, 1440, 2880], cells: [{ flags: 1 << 5, width: 0 }] },
    ]))
    expect(nodes(root, 'hMerge').map(node => attr(node))).toEqual(['restart', 'continue'])
    expect(nodes(root, 'vMerge').map(node => attr(node))).toEqual(['restart', 'continue'])
    expect(nodes(root, 'tc')).toHaveLength(4)
    expect(nodes(root, 't').map(node => node.children.join('')).join('')).toBe('AhiddenstoredB')
  })

  it('omits a refused optional graph atomically while preserving its previously verified cells and text', () => {
    const bytes = tableDocument([{ texts: ['A'], edges: [0, 1440], cells: [{ flags: 1 << 5, width: 0 }] }])
    const { root, report } = document(bytes)
    expect(nodes(root, 'tc')).toHaveLength(1)
    expect(nodes(root, 'gridCol')).toEqual([])
    expect(nodes(root, 'vMerge')).toEqual([])
    expect(nodes(root, 't').map(node => node.children.join('')).join('')).toBe('A')
    expect(report.diagnostics.filter(value => value.code.startsWith('table-')).map(value => value.code)).toEqual(['table-geometry-unprojected'])
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-table-data' }))
  })

  it('reports presentation-only host gaps while retaining the exact stored cell settings', () => {
    const { root, report } = document(tableDocument([{ texts: ['A'], edges: [0, 1440],
      cells: [{ flags: 1 << 2 | 0x1000 | 0x4000, width: 0 }], properties: op(0xf617, 3, 120, 0) }]))
    expect(nodes(root, 'textDirection').map(node => attr(node))).toEqual(['tbRl'])
    expect(nodes(root, 'tcFitText').map(node => attr(node))).toEqual(['1'])
    expect(nodes(root, 'hideMark').map(node => attr(node))).toEqual(['1'])
    expect(report.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'table-cell-presentation-host-limit', kind: 'host-limit' }),
      expect.objectContaining({ code: 'table-preferred-offset-host-limit', kind: 'host-limit' })
    ]))
  })

  it('propagates missing internal authority and output-budget exhaustion', () => {
    const bytes = tableDocument([{ texts: ['A'], edges: [0, 1440] }])
    const source = readConversionSource(bytes, {})
    source.tableRowOperations = new Map()
    const context = createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 3, paragraphs: 3, characterRuns: 3, tables: 1, styles: 1, fonts: 6, sections: 1 })
    expect(() => projectSourceTable(source, 0, () => [], context)).toThrow('Missing captured source table-row authority')
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', outputLimits: { maxXmlNodes: 1 } }))
      .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
  })
})
