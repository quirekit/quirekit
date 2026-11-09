/** One canonical structural mutation, independent of table styles and visual formatting. */
export type RowDefinitionChange =
  | { kind: 'initial', count: number, edges: readonly number[], cells: readonly Uint8Array[] }
  | { kind: 'insert', count: number, at: number, inserted: number, width: number }
  | { kind: 'delete', count: number, first: number, end: number }
