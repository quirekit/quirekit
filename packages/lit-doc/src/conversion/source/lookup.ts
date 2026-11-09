/**
 * Finds the first source interval extending beyond a CP without rescanning preceding stories.
 * @param records - Nonoverlapping intervals in source order.
 * @param position - Inclusive starting CP.
 * @returns First candidate index, or the collection length after all intervals.
 */
export function findSourceInterval(records: readonly { end: number }[], position: number): number {
  let lower = 0
  let upper = records.length
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (records[middle]!.end <= position) lower = middle + 1
    else upper = middle
  }
  return lower
}
