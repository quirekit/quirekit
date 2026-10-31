import type { QuireAiSkillRecord, QuireAiSkillStore, QuireAiSkillSummary } from "../types";

/**
 * Creates a read-only store over skills held in memory, such as the built-in ones.
 * @param records - Skills.
 * @returns Store listing and returning them.
 */
export function createQuireAiMemorySkillStore(records: readonly QuireAiSkillRecord[]): QuireAiSkillStore {
  const byId = new Map(records.map(record => [record.id, record]));
  return Object.freeze({
    list: async (): Promise<readonly QuireAiSkillSummary[]> => records.map(({ files: _files, ...summary }) => summary),
    get: async (id: string): Promise<QuireAiSkillRecord | null> => byId.get(id) ?? null
  });
}
