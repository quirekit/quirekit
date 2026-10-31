import type { QuireAiSkillRecord, QuireAiSkillStore, QuireAiSkillSummary } from "../types";
import { validateQuireAiSkillRecord } from "../validate";

/** Options of the IndexedDB skill store. */
export interface QuireAiIndexedDbSkillStoreOptions {
  /** Database name; default `quirekit-ai-skills`. */
  readonly database?: string | undefined;
  /** IndexedDB factory; default the global `indexedDB`. */
  readonly factory?: IDBFactory | undefined;
}

/** Object store holding one skill record per id. */
const objectStore = "skills";

/**
 * Creates a skill store in browser IndexedDB, one adapter of the skill data format:
 * records are stored as they are, binary files as bytes, and checked before saving.
 * @param options - Database name and factory.
 * @returns Writable skill store.
 */
export function createQuireAiIndexedDbSkillStore(options: QuireAiIndexedDbSkillStoreOptions = {}): Required<QuireAiSkillStore> {
  let opening: Promise<IDBDatabase> | undefined;

  /** @returns The open database, created on first use. */
  function open(): Promise<IDBDatabase> {
    return opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const factory = options.factory ?? globalThis.indexedDB;
      if (factory === undefined) { reject(new Error("IndexedDB is not available in this environment.")); return; }
      const request = factory.open(options.database ?? "quirekit-ai-skills", 1);
      request.onupgradeneeded = () => { request.result.createObjectStore(objectStore, { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open the skill database."));
    }).catch(error => { opening = undefined; throw error; });
  }

  /**
   * Runs one request in a transaction.
   * @param mode - Transaction mode.
   * @param run - Creates the request from the object store.
   * @returns The request result once the transaction completes.
   */
  async function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(objectStore, mode);
      const pending = run(transaction.objectStore(objectStore));
      transaction.oncomplete = () => resolve(pending.result);
      transaction.onerror = () => reject(transaction.error ?? pending.error ?? new Error("The skill database request failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("The skill database request was aborted."));
    });
  }

  return Object.freeze({
    async list(): Promise<readonly QuireAiSkillSummary[]> {
      const records = await request<QuireAiSkillRecord[]>("readonly", store => store.getAll());
      return records.map(({ files: _files, ...summary }) => summary);
    },
    async get(id: string): Promise<QuireAiSkillRecord | null> {
      return (await request<QuireAiSkillRecord | undefined>("readonly", store => store.get(id))) ?? null;
    },
    async put(record: QuireAiSkillRecord): Promise<void> {
      const problems = validateQuireAiSkillRecord(record);
      if (problems.length > 0) throw new Error(`The skill does not match the data format: ${problems.join("; ")}.`);
      await request("readwrite", store => store.put(record));
    },
    async remove(id: string): Promise<void> {
      await request("readwrite", store => store.delete(id));
    }
  });
}
