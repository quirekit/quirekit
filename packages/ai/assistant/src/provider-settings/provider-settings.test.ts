// @vitest-environment happy-dom
import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import ProviderSettings from "./provider-settings.vue";
import { createQuireAiProfileFromPreset, quireAiProviderPresets } from "./presets";
import { createQuireAiProviderSettings } from "./controller";

const cleanup: Array<() => void> = [];
afterEach(async () => {
  cleanup.splice(0).reverse().forEach(dispose => dispose());
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
});

/** @returns A local-only settings task with real public Form and no request controller. */
async function mountSettings() {
  const host = document.createElement("div");
  document.body.append(host);
  const state = reactive({ open: true });
  const save = vi.fn();
  const profile = createQuireAiProfileFromPreset(quireAiProviderPresets[0]!, "model-1");
  const app = createApp({ render: () => h(ProviderSettings, {
    state, initialDraft: { mode: "browser", profiles: [profile], defaultProfileId: profile.id, hostUrl: "" },
    onClose: () => { state.open = false; }, onSave: save
  }) });
  app.mount(host);
  cleanup.push(() => { app.unmount(); host.remove(); });
  await expect.poll(() => document.querySelector<HTMLInputElement>('[aria-label="模型 ID"]')?.value).toBe(profile.model);
  return { state, save, profile };
}

/** @param label - Native input accessible label. @param value - User-authored text. */
function fill(label: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("discards the Form draft on cancel and restores the stored model on reopen", async () => {
  const { state, save, profile } = await mountSettings();
  fill("模型 ID", "unsaved-model");
  await nextTick();
  expect(document.querySelector<HTMLInputElement>('[aria-label="模型 ID"]')?.value).toBe("unsaved-model");
  state.open = false;
  await nextTick();
  state.open = true;
  await expect.poll(() => document.querySelector<HTMLInputElement>('[aria-label="模型 ID"]')?.value).toBe(profile.model);
  expect(save).not.toHaveBeenCalled();
});

it("retains invalid drafts and emits only a validated settings snapshot", async () => {
  const { save } = await mountSettings();
  fill("API Base URL", "invalid-url");
  await nextTick();
  document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await expect.poll(() => document.querySelector('[role="alert"]')?.textContent).toContain("valid URL");
  expect(save).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLInputElement>('[aria-label="API Base URL"]')?.value).toBe("invalid-url");
  fill("API Base URL", "http://127.0.0.1:9999/v1");
  await nextTick();
  document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await expect.poll(() => save.mock.calls.length).toBe(1);
  expect(save.mock.calls[0]?.[0].profiles[0].baseUrl).toBe("http://127.0.0.1:9999/v1");
});

it("uses managed persistence without reading browser credentials and keeps failed saves editable", async () => {
  const local: Storage = { length: 0, key: vi.fn(), getItem: vi.fn(() => { throw new Error("no browser credentials"); }),
    setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
  const profile = createQuireAiProfileFromPreset(quireAiProviderPresets[0]!, "team-model");
  const save = vi.fn().mockRejectedValueOnce(new Error("团队设置保存失败")).mockResolvedValue(undefined);
  const reconnect = vi.fn(), clear = vi.fn().mockResolvedValue(undefined);
  const settings = createQuireAiProviderSettings({ ownerDocument: document, storage: { local }, defaultHostUrl: "", reconnect,
    persistence: { initialDraft: { mode: "browser", profiles: [profile], defaultProfileId: profile.id, hostUrl: "" }, save, clear } });
  cleanup.push(() => settings.destroy());
  settings.open();
  await expect.poll(() => document.querySelector<HTMLInputElement>('[aria-label="模型 ID"]')?.value).toBe(profile.model);
  expect(document.body.textContent).toContain("模型服务");
  expect(document.body.textContent).not.toContain("浏览器直连");
  fill("模型 ID", "team-default");
  await nextTick();
  document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await expect.poll(() => document.querySelector('[role="alert"]')?.textContent).toContain("团队设置保存失败");
  expect(reconnect).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLInputElement>('[aria-label="模型 ID"]')?.value).toBe("team-default");
  document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await expect.poll(() => reconnect.mock.calls.length).toBe(1);
  expect(save.mock.lastCall?.[0].profiles[0].model).toBe("team-default");
  expect(local.getItem).not.toHaveBeenCalled();
  expect(local.setItem).not.toHaveBeenCalled();
  expect(local.removeItem).not.toHaveBeenCalled();
});

it("words host-kept personal models as the person's own, not the team's", async () => {
  const profile = createQuireAiProfileFromPreset(quireAiProviderPresets[0]!, "own-model");
  const settings = createQuireAiProviderSettings({ ownerDocument: document, storage: { local: localStorage }, defaultHostUrl: "", reconnect: vi.fn(),
    persistence: { scope: "personal", initialDraft: { mode: "browser", profiles: [profile], defaultProfileId: profile.id, hostUrl: "" }, save: vi.fn(), clear: vi.fn() } });
  cleanup.push(() => settings.destroy());
  settings.open();
  await expect.poll(() => document.body.textContent).toContain("个人 AI 模型");
  expect(document.body.textContent).toContain("系统钥匙串");
  expect(document.body.textContent).not.toContain("团队");
});
