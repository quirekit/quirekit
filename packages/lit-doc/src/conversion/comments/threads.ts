import type { DocCommentEntry } from '../../word/comments/types'

/**
 * Resolves root membership in linear work even when parent records occur later.
 * @param entries - Validated acyclic graph with strictly decreasing parent depths.
 * @returns Parallel root slots in original reference order.
 */
export function commentThreadRoots(entries: readonly DocCommentEntry[]): number[] {
  const roots = Array<number>(entries.length).fill(-1)
  for (const entry of entries) {
    const path: number[] = []
    let cursor = entry.index
    while (roots[cursor] === -1) {
      path.push(cursor)
      const parent = entries[cursor]!.extra?.parentIndex
      if (parent === null || parent === undefined) { roots[cursor] = cursor; break }
      cursor = parent
    }
    const root = roots[cursor]!
    for (const index of path) roots[index] = root
  }
  return roots
}
