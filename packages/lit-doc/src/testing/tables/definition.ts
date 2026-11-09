import { operation } from '../formatting'

/**
 * Encodes independent source edges and optional complete TC80 records.
 * @param edges - Logical-page twip positions, including the final edge.
 * @param cells - Explicit flags and preferred widths; omitted trailing records stay absent.
 * @returns Complete TDefTable operation, including its two-byte operand length.
 */
export function tableDefinition(edges: readonly number[], cells: readonly { flags: number, width: number }[] = []): number[] {
  const size = 3 + edges.length * 2 + cells.length * 20
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, size - 1, true)
  bytes[2] = edges.length - 1
  edges.forEach((value, index) => view.setInt16(3 + index * 2, value, true))
  cells.forEach((value, index) => {
    view.setUint16(3 + edges.length * 2 + index * 20, value.flags, true)
    view.setInt16(5 + edges.length * 2 + index * 20, value.width, true)
  })
  return operation(0xd608, ...bytes)
}
