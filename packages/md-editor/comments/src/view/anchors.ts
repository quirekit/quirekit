/**
 * @param previous - Anchor tops last applied to the rail, by item id.
 * @param next - Freshly measured anchor tops.
 * @returns Whether the rail must update: an item appeared, disappeared or moved by more than half a pixel.
 * A submitted draft swaps the `draft` key for the new thread id at the same size, so a new key always counts.
 */
export function anchorsChanged(previous: ReadonlyMap<string, number>, next: ReadonlyMap<string, number>): boolean {
  return next.size !== previous.size || [...next].some(([id, value]) => !previous.has(id) || Math.abs(previous.get(id)! - value) > 0.5);
}
