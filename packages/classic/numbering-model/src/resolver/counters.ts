import type { WordNumberingLevel } from "../types";

/**
 * Advances one instance's derived counter context in document order.
 *
 * @param values - Mutable counters scoped to the current immutable document traversal.
 * @param level - Current effective level definition.
 * @param startOverride - Optional paragraph-local restart value.
 * @param levels - Effective level definitions for this instance.
 */
export function advanceWordNumberingCounters(
  values: Array<number | undefined>,
  level: WordNumberingLevel,
  startOverride: number | null,
  levels: Readonly<Record<string, WordNumberingLevel>>
): void {
  // A descendant can establish a default ancestor before its first real paragraph.
  // Persist that start in this traversal so the real ancestor continues it once.
  // Never-restarting children count actual paragraphs separately from virtual prefixes.
  for (let ancestor = 0; ancestor < level.level; ancestor += 1) {
    const definition = levels[String(ancestor)];
    if (values[ancestor] === undefined && definition !== undefined
      && (ancestor === 0 || definition.restartAfterLevel !== null)) {
      values[ancestor] = definition.start;
    }
  }

  const current = values[level.level];
  values[level.level] = startOverride ?? (current === undefined ? level.start : current + 1);

  // Reset only descendants governed by the encountered level. Undefined remains
  // distinct from zero, allowing a later skipped ancestor to restart at its own start.
  for (let deeper = level.level + 1; deeper < values.length; deeper += 1) {
    const definition = levels[String(deeper)];
    if (definition !== undefined && shouldRestartDeeperLevel(definition, level.level)) {
      values[deeper] = undefined;
    }
  }
}

/**
 * Reports whether one encountered ancestor restarts a deeper counter.
 *
 * @param level - Deeper level carrying the restart policy.
 * @param encounteredLevel - Level just advanced in document order.
 * @returns Whether the deeper counter must be cleared.
 */
function shouldRestartDeeperLevel(level: WordNumberingLevel, encounteredLevel: number): boolean {
  if (level.restartAfterLevel === null) return false;
  const trigger = level.restartAfterLevel ?? level.level - 1;
  return encounteredLevel <= trigger;
}
