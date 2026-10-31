// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { createMdEditorAi } from "./create";
import type { MdEditorAiOptions } from "./types";
import type { QuireAiModelConnection } from "@quirekit/ai-assistant";
import { mountMdEditorAiPanel } from "./panel";
import { createQuireAiProviderSettings, resolveQuireAiModelConnection } from "@quirekit/ai-assistant";

vi.mock("@quirekit/ai-assistant", () => ({ createQuireAiProviderSettings: vi.fn(), resolveQuireAiModelConnection: vi.fn() }));
vi.mock("@quirekit/msfe-ai", () => ({ MsfeAi: {} }));
vi.mock("./panel", () => ({ mountMdEditorAiPanel: vi.fn() }));

it("resolves a managed connection lazily without loading saved provider settings", async () => {
  const models = { primaryModel: { id: "team" } } as QuireAiModelConnection;
  const connection = vi.fn(async () => models);
  const options: MdEditorAiOptions = { ownerDocument: document, storage: localStorage, connection };
  const assistant = createMdEditorAi(options);
  expect(connection).not.toHaveBeenCalled();
  assistant.panel.mount({} as Parameters<typeof assistant.panel.mount>[0]);
  const args = vi.mocked(mountMdEditorAiPanel).mock.lastCall!;
  expect(args[2]).toBeUndefined();
  expect(await args[3]()).toBe(models);
  expect(await args[3]()).toBe(models);
  expect(connection).toHaveBeenCalledTimes(1);
  expect(createQuireAiProviderSettings).not.toHaveBeenCalled();
  expect(resolveQuireAiModelConnection).not.toHaveBeenCalled();
  assistant.destroy();
});
