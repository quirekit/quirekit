import { describe, expect, it } from "vitest";
import {
  clearQuireAiProviderSettings,
  loadQuireAiProviderSettings,
  saveQuireAiProviderSettings
} from "./storage";
import type { QuireAiProviderSettingsDraft } from "./types";
import { validateQuireAiProviderSettings } from "./validate";

describe("local AI provider settings", () => {
  it("opens an unconfigured product with DeepSeek, Qwen, and MiMo profiles", () => {
    const loaded = loadQuireAiProviderSettings({
      local: new MemoryStorage()
    }, "");

    expect(loaded.configured).toBe(false);
    expect(loaded.draft.defaultProfileId).toBe("profile-deepseek");
    expect(loaded.draft.profiles.map(profile => ({
      provider: profile.providerLabel,
      protocol: profile.protocol,
      context: profile.contextWindowTokens
    }))).toEqual([
      {
        provider: "DeepSeek",
        protocol: "openai-completions",
        context: 1_000_000
      },
      {
        provider: "Qwen",
        protocol: "openai-completions",
        context: 1_000_000
      },
      {
        provider: "MiMo",
        protocol: "openai-responses",
        context: 1_000_000
      }
    ]);
  });

  it("keeps profile credentials separate from public configuration", () => {
    const local = new MemoryStorage();
    const storage = { local };
    const draft = createDraft();
    draft.profiles[0]!.apiKey = "browser-secret";
    saveQuireAiProviderSettings(storage, draft);

    const publicDocument = [...local.values()].find(value => (
      value.includes('"profiles"')
    ));
    expect(publicDocument).not.toContain("browser-secret");
    expect([...local.values()].join("\n")).toContain("browser-secret");
    const loaded = loadQuireAiProviderSettings(storage, "");
    expect(loaded.configured).toBe(true);
    expect(loaded.draft.mode).toBe("browser");
    expect(loaded.draft.profiles[0]).toMatchObject({
      apiKey: "browser-secret",
      providerLabel: "DeepSeek"
    });

    clearQuireAiProviderSettings(storage);
    expect(local.length).toBe(0);
  });

  it("persists every entered credential across browser restarts", () => {
    const local = new MemoryStorage();
    const draft = createDraft();
    draft.profiles[0]!.apiKey = "deepseek-secret";
    draft.profiles[1]!.apiKey = "qwen-secret";
    saveQuireAiProviderSettings({ local }, draft);

    expect([...local.values()].join("\n")).toContain("deepseek-secret");
    expect([...local.values()].join("\n")).toContain("qwen-secret");

    const reloaded = loadQuireAiProviderSettings({
      local
    }, "");
    expect(reloaded.draft.profiles[0]?.apiKey).toBe("deepseek-secret");
    expect(reloaded.draft.profiles[1]?.apiKey).toBe("qwen-secret");
  });

  it("rejects credential-bearing URLs and context budgets without headroom", () => {
    const first = createDraft();
    first.profiles[0]!.baseUrl = "https://user:secret@api.example.test";
    expect(() => validateQuireAiProviderSettings(first)).toThrow(
      /must not contain credentials/iu
    );

    const second = createDraft();
    second.profiles[0]!.contextWindowTokens = 32_768;
    second.profiles[0]!.contextBudgetPercent = 70;
    second.profiles[0]!.maxOutputTokens = 32_768;
    expect(() => validateQuireAiProviderSettings(second)).toThrow(
      /must leave room/iu
    );
  });
});

/**
 * Creates a mutable clone of the default catalog for test authoring.
 *
 * @returns Mutable settings draft.
 */
function createDraft(): MutableDraft {
  const source = loadQuireAiProviderSettings({
    local: new MemoryStorage()
  }, "").draft;
  return {
    mode: source.mode,
    profiles: source.profiles.map(profile => ({ ...profile })),
    defaultProfileId: source.defaultProfileId,
    hostUrl: source.hostUrl
  };
}

/** Mutable test-only counterpart of the settings draft. */
interface MutableDraft extends Omit<QuireAiProviderSettingsDraft, "profiles"> {
  /** Mutable profile collection. */
  readonly profiles: Array<{
    -readonly [Key in keyof QuireAiProviderSettingsDraft["profiles"][number]]:
      QuireAiProviderSettingsDraft["profiles"][number][Key];
  }>;
}

/** Minimal deterministic Storage implementation for configuration tests. */
class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  /** Number of stored entries. */
  get length(): number {
    return this.#values.size;
  }

  /** Removes all entries. */
  clear(): void {
    this.#values.clear();
  }

  /** @param key - Storage key. @returns Stored value or null. */
  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  /** @param index - Ordered entry index. @returns Key or null. */
  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  /** @param key - Storage key to remove. */
  removeItem(key: string): void {
    this.#values.delete(key);
  }

  /** @param key - Storage key. @param value - Stored value. */
  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }

  /** @returns Current values for secret-separation assertions. */
  values(): IterableIterator<string> {
    return this.#values.values();
  }
}
