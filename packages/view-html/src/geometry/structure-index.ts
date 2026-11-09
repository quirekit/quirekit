import { createQuireSelectionStructureIntervalIndex, type QuireSelectionStructureIntervalIndex } from "@quirekit/view-engine";

/**
 * Captures immutable document facts, compiling only when a structural consumer reads them.
 * @param options - Exact document and adapter authority for this snapshot.
 * @returns Complete source index whose first use performs one compilation.
 */
export function createHtmlSelectionStructureIndex(options: Parameters<typeof createQuireSelectionStructureIntervalIndex>[0]): QuireSelectionStructureIntervalIndex {
  let compiled: QuireSelectionStructureIntervalIndex | undefined;
  /** @returns The one complete index owned by this immutable source snapshot. */
  const read = (): QuireSelectionStructureIntervalIndex => compiled ??= createQuireSelectionStructureIntervalIndex(options);
  return {
    get entries() { return read().entries; },
    get entryCount() { return read().entryCount; },
    query: range => read().query(range)
  };
}
