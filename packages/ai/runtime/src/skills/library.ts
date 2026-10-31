import type { QuireAiSkillEntry, QuireAiSkillLibrary, QuireAiSkillLibraryOptions, QuireAiSkillRecord, QuireAiSkillSummary } from "./types";
import { validateQuireAiSkillRecord } from "./validate";

/**
 * Creates a skill library over several stores.
 *
 * Lists are loaded by `refresh` and kept as a synchronous snapshot, so tool descriptions
 * can be built without waiting. A later source overrides a skill of the same id in an
 * earlier one; content is read from the overriding source and checked against the data
 * format before the model sees it.
 *
 * @param options - Sources in increasing priority and the enabled filter.
 * @returns Skill library.
 */
export function createQuireAiSkillLibrary(options: QuireAiSkillLibraryOptions): QuireAiSkillLibrary {
  const lists = new Map<string, readonly QuireAiSkillSummary[]>();
  const listeners = new Set<() => void>();
  const cache = new Map<string, QuireAiSkillRecord>();
  let snapshot: readonly QuireAiSkillEntry[] = [];

  /** Rebuilds the merged snapshot from the per-source lists. */
  function rebuild(): void {
    const merged = new Map<string, QuireAiSkillEntry>();
    for (const source of options.sources) {
      for (const summary of lists.get(source.id) ?? []) {
        const previous = merged.get(summary.id);
        merged.set(summary.id, { ...summary, sourceId: source.id, overrides: previous === undefined ? [] : [...previous.overrides, previous.sourceId] });
      }
    }
    snapshot = [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  /** @param sourceId - Source identifier. @returns The source's store with save and remove. */
  function writableStore(sourceId: string) {
    const store = options.sources.find(source => source.id === sourceId)?.store;
    if (store?.put === undefined || store.remove === undefined) throw new Error(`Skill source ${sourceId} cannot save skills.`);
    return store as Required<typeof store>;
  }

  /**
   * @param sourceId - Source identifier.
   * @param id - Skill identifier.
   * @param version - Listed version, the cache key.
   * @returns The validated skill, or null.
   */
  async function load(sourceId: string, id: string, version: string | undefined): Promise<QuireAiSkillRecord | null> {
    const key = `${sourceId}\u0000${id}\u0000${version ?? ""}`;
    const cached = version === undefined ? undefined : cache.get(key);
    if (cached !== undefined) return cached;
    const record = await options.sources.find(source => source.id === sourceId)?.store.get(id) ?? null;
    if (record === null || validateQuireAiSkillRecord(record).length > 0 || record.id !== id) return null;
    if (version !== undefined) cache.set(key, record);
    return record;
  }

  const library: QuireAiSkillLibrary = {
    sources: () => options.sources.map(source => ({ id: source.id, label: source.label, writable: source.store.put !== undefined && source.store.remove !== undefined })),
    entries: () => snapshot,
    enabledEntries: () => snapshot.filter(entry => options.enabled?.(entry) ?? true),
    async refresh() {
      const problems: string[] = [];
      await Promise.all(options.sources.map(async source => {
        try {
          lists.set(source.id, await source.store.list());
        } catch (error) {
          problems.push(`${source.label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }));
      rebuild();
      for (const listener of listeners) listener();
      return problems;
    },
    async read(id) {
      const entry = snapshot.find(candidate => candidate.id === id);
      return entry === undefined ? null : load(entry.sourceId, id, entry.version);
    },
    readFrom: (sourceId, id) => load(sourceId, id, undefined),
    async save(sourceId, record) {
      const problems = validateQuireAiSkillRecord(record);
      if (problems.length > 0) throw new Error(`The skill does not match the data format: ${problems.join("; ")}.`);
      await writableStore(sourceId).put(record);
      // An edit may keep its version; cached content must not outlive it.
      cache.clear();
      await library.refresh();
    },
    async remove(sourceId, id) {
      await writableStore(sourceId).remove(id);
      cache.clear();
      await library.refresh();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  return Object.freeze(library);
}
