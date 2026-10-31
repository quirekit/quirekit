import type { QuireAiSourceChangeSet } from "../types";

/**
 * Maps a position through one change set.
 * @param changes - Sorted, non-overlapping replacements in the position's coordinates.
 * @param pos - Position before the changes.
 * @param assoc - Side a position at or inside a replacement sticks to: -1 before it, 1 after it.
 * @returns Position after the changes.
 */
export function mapQuireAiSourcePos(changes: QuireAiSourceChangeSet, pos: number, assoc: -1 | 1): number {
  let delta = 0;
  for (const change of changes) {
    if (change.from > pos || (change.from === pos && change.to === pos && assoc < 0)) break;
    if (change.to < pos || (change.to === pos && change.from < pos && assoc > 0)) {
      delta += change.insert.length - (change.to - change.from);
      continue;
    }
    // At or inside the replaced text: stick to the side the caller asked for.
    return change.from + delta + (assoc > 0 ? change.insert.length : 0);
  }
  return pos + delta;
}

/**
 * Maps a position through change sets applied one after another.
 * @param sets - Change sets in order, each in the coordinates after the previous one.
 * @param pos - Position before the first set.
 * @param assoc - Side to stick to.
 * @returns Position after the last set.
 */
export function mapQuireAiSourcePosThrough(sets: readonly QuireAiSourceChangeSet[], pos: number, assoc: -1 | 1): number {
  let result = pos;
  for (const changes of sets) result = mapQuireAiSourcePos(changes, result, assoc);
  return result;
}

/**
 * @param text - Text before the changes.
 * @param changes - Sorted, non-overlapping replacements.
 * @returns Text after the changes.
 */
export function applyQuireAiSourceChanges(text: string, changes: QuireAiSourceChangeSet): string {
  let result = "";
  let at = 0;
  for (const change of changes) {
    result += text.slice(at, change.from) + change.insert;
    at = change.to;
  }
  return result + text.slice(at);
}

/**
 * Inverts a change set.
 * @param changes - Replacements in the coordinates before them.
 * @param removed - Text each replacement removed.
 * @returns Replacements restoring the text, in the coordinates after the change set.
 */
export function invertQuireAiSourceChanges(changes: QuireAiSourceChangeSet, removed: readonly string[]): QuireAiSourceChangeSet {
  let delta = 0;
  return changes.map((change, index) => {
    const from = change.from + delta;
    delta += change.insert.length - (change.to - change.from);
    return { from, to: from + change.insert.length, insert: removed[index] ?? "" };
  });
}

/**
 * Sorts replacements and checks they do not overlap.
 * @param changes - Replacements in one set of coordinates.
 * @returns Sorted replacements, or null when two of them overlap.
 */
export function normalizeQuireAiSourceChanges(changes: QuireAiSourceChangeSet): QuireAiSourceChangeSet | null {
  const sorted = [...changes].sort((left, right) => left.from - right.from || left.to - right.to);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.from < sorted[index - 1]!.to) return null;
  }
  return sorted;
}
