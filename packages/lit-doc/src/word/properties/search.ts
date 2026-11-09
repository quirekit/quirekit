/**
 * Finds the physical interval whose inclusive start is the last boundary at or before a value.
 * @param boundaries - Strictly increasing physical boundaries, including the exclusive end.
 * @param value - Physical byte position.
 * @returns Interval index, or -1 when outside the covered range.
 */
export function findByteInterval(boundaries: readonly number[], value: number): number {
  if (value < boundaries[0]! || value >= boundaries[boundaries.length - 1]!) return -1
  let low = 0
  let high = boundaries.length - 1
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (boundaries[middle]! <= value) low = middle
    else high = middle
  }
  return low
}
