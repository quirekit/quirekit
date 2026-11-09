import type { ByteView } from '../../binary/bytes'

/**
 * Finds omitted stream slots only when the directory proves that root is their sole possible parent.
 * @param view - Actual complete directory fields, without synthetic entries.
 * @param slots - Bounded number of readable directory records.
 * @param visited - Identities already consumed through the original directory graph.
 * @returns Detached stream identities, or none when any other parent is possible.
 */
export function findFlatDetachedStreams(view: ByteView, slots: number, visited: Uint8Array): number[] {
  const detached: number[] = []
  // A missing edge cannot erase another storage's ownership. Inspect every used
  // slot before admitting any candidate; one ambiguous slot cancels the batch.
  for (let id = 1; id < slots; id++) {
    const offset = id * 128, type = view.u8(offset + 66)
    if (type === 0 && view.u16(offset + 64) === 0) {
      let unused = true
      for (let index = 0; index < 64; index += 2) if (view.u16(offset + index)) { unused = false; break }
      if (unused) continue
    }
    if (type !== 2 || view.u32(offset + 76) !== 0xffffffff) return []
    if (!visited[id]) detached.push(id)
  }
  return detached
}
