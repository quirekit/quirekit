import type { QuireJSONContent } from '@quirekit/core'
import { Schema } from '@quirekit/pm'
import { describe, expect, it } from 'vitest'
import { wordTableNodeSpecs } from '../schema'
import { splitWordTableCell } from '../commands/split'
import { createWordTableMap } from './build'

const schema = new Schema({ nodes: { doc: { content: 'block+' }, text: { group: 'inline' },
  paragraph: { group: 'block', content: 'inline*' }, token: { inline: true, group: 'inline', atom: true }, ...wordTableNodeSpecs } })

/** @param attrs - Explicit source properties. @param text - Stored source text. @returns Independent physical cell JSON. */
function cell(attrs: Record<string, unknown> = {}, text = ''): QuireJSONContent {
  return { type: 'wordTableCell', attrs, content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] }
}

/** @param rows - Physical source rows. @param columns - Declared grid width. @param before - First row's source offset. @returns Actual canonical table node. */
function table(rows: readonly (readonly QuireJSONContent[])[], columns: number, before = 0) {
  return schema.nodeFromJSON({ type: 'wordTable', attrs: { grid: Array.from({ length: columns }, () => ({ width: { value: 1000, unit: 'dxa' } })) },
    content: rows.map((content, index) => ({ type: 'wordTableRow', attrs: { gridBefore: index === 0 ? before : 0 }, content })) })
}

describe('legacy horizontal merge semantic ownership', () => {
  it('retains two physical cells and positions while deriving one semantic rectangle and shared slots', () => {
    const source = table([[cell({ hMerge: 'restart' }, 'A'), cell({ hMerge: 'continue' })]], 2)
    const original = source.toJSON(), map = createWordTableMap(source)
    expect(map.explicitCells).toHaveLength(2)
    expect(map.semanticCells).toHaveLength(1)
    expect(map.semanticCells[0]).toMatchObject({ rect: { startRow: 0, rowSpan: 1, startColumn: 0, columnSpan: 2 }, gridSpan: 2,
      continuationExplicitCellIds: [map.explicitCells[1]!.id], wellFormed: true })
    expect(map.slotAt(0, 0)).toMatchObject({ role: 'origin', explicitCellId: map.explicitCells[0]!.id })
    expect(map.slotAt(0, 1)).toMatchObject({ role: 'horizontalSpan', explicitCellId: map.explicitCells[1]!.id,
      semanticCellId: map.semanticCells[0]!.id })
    expect(map.diagnostics).toEqual([])
    expect(source.toJSON()).toEqual(original)
  })

  it('stops a group at normal cells and new restarts while retaining grid spans and row offsets', () => {
    const source = table([[cell({ hMerge: 'restart', gridSpan: 2, colspan: 2 }), cell({ hMerge: 'continue' }),
      cell(), cell({ hMerge: 'restart' }), cell({ hMerge: 'continue' })]], 7, 1)
    const map = createWordTableMap(source)
    expect(map.semanticCells.map(value => [value.rect.startColumn, value.rect.columnSpan])).toEqual([[1, 3], [4, 1], [5, 2]])
    expect(map.slotAt(0, 0)?.kind).toBe('rowOffset')
    expect(map.diagnostics).toEqual([])
  })

  it('resolves the complete horizontal interval before matching a vertical chain', () => {
    const source = table([
      [cell({ hMerge: 'restart', vMerge: 'restart' }, 'A'), cell({ hMerge: 'continue', vMerge: 'restart' })],
      [cell({ hMerge: 'restart', vMerge: 'continue' }), cell({ hMerge: 'continue', vMerge: 'continue' })],
    ], 2)
    const map = createWordTableMap(source)
    expect(map.semanticCells).toHaveLength(1)
    expect(map.semanticCells[0]?.rect).toEqual({ startRow: 0, rowSpan: 2, startColumn: 0, columnSpan: 2 })
    expect(map.explicitCells).toHaveLength(4)
    expect(map.semanticCells[0]?.continuationExplicitCellIds).toHaveLength(3)
    expect([map.slotAt(0, 0), map.slotAt(0, 1), map.slotAt(1, 0), map.slotAt(1, 1)].map(slot => slot?.kind === 'cell' ? slot.role : undefined))
      .toEqual(['origin', 'horizontalSpan', 'verticalContinuation', 'covered'])
    expect(map.diagnostics).toEqual([])
  })

  it.each(['text', 'atom', 'space'])('preserves hidden continuation %s and diagnoses unsafe structural editing', kind => {
    const originalHidden = cell({ hMerge: 'continue' }, kind === 'text' ? 'stored' : kind === 'space' ? ' ' : '')
    const hidden = kind === 'atom' ? { ...originalHidden, content: [{ type: 'paragraph', content: [{ type: 'token' }] }] } : originalHidden
    const source = table([[cell({ hMerge: 'restart' }, 'A'), hidden]], 2)
    const original = source.toJSON(), map = createWordTableMap(source)
    expect(map.diagnostics.map(value => value.code)).toContain('hmerge-continuation-content')
    expect(map.semanticCells[0]?.wellFormed).toBe(false)
    expect(splitWordTableCell(source, { rowIndex: 0, columnIndex: 0 }).ok).toBe(false)
    expect(source.toJSON()).toEqual(original)
  })

  it('diagnoses an orphan continuation and inconsistent vertical roles without repairing source data', () => {
    const orphan = createWordTableMap(table([[cell({ hMerge: 'continue' })]], 1))
    expect(orphan.diagnostics.map(value => value.code)).toContain('hmerge-orphan-continue')
    const mixed = createWordTableMap(table([[cell({ hMerge: 'restart', vMerge: 'restart' }), cell({ hMerge: 'continue' })]], 2))
    expect(mixed.diagnostics.map(value => value.code)).toContain('hmerge-vertical-role-mismatch')
  })

  it('splits all owned physical cells and removes legacy markers from the new endpoint', () => {
    const source = table([[cell({ hMerge: 'restart' }, 'A'), cell({ hMerge: 'continue' })]], 2)
    const result = splitWordTableCell(source, { rowIndex: 0, columnIndex: 0 })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected a supported horizontal split')
    expect(result.value.child(0).childCount).toBe(2)
    expect(result.value.child(0).children.map(value => value.attrs.hMerge)).toEqual([null, null])
    expect(createWordTableMap(result.value).semanticCells).toHaveLength(2)
    expect(createWordTableMap(result.value).diagnostics).toEqual([])
    expect(result.value.textContent).toBe('A')
  })
})
