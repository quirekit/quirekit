// @vitest-environment happy-dom
import { createApp, h, nextTick } from "vue";
import { expect, it, vi } from "vitest";
import { createAiChatController } from "../session/controller";
import { createChatFixture } from "../session/fixture.test-support";
import type { AiChatResponderRequest } from "../types";
import Workspace from "./workspace.vue";

it("renders real streamed Markdown Parts through QuireMarkdown and retains content on stop", async () => {
  let request!: AiChatResponderRequest;
  const fixture = createChatFixture({ respond: value => new Promise((_, reject) => {
    request = value; value.signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")), { once: true });
  }) });
  const controller = createAiChatController(fixture.options), root = document.createElement("div"); document.body.append(root);
  const errors: unknown[] = [];
  const app = createApp({ render: () => h(Workspace, { controller, locale: "en" }) });
  app.config.errorHandler = error => { errors.push(error); }; app.mount(root);
  controller.setDraft("Explain references"); const completed = controller.submit();
  try {
    request.onContentDelta("[foo][bar][baz] [doc][api]\n\n"); await nextTick();
    request.onContentDelta("[baz]: /target\n[api]: /first\n[api]: /wrong\n\n```ts\na\nb");
    await vi.waitFor(() => expect(root.querySelector('a[href="/target"]')?.textContent).toBe("bar"));
    expect(root.querySelector('a[href="/first"]')?.textContent).toBe("doc");
    expect(root.querySelector('a[href="/wrong"]')).toBeNull();
    controller.stop(); await completed; await nextTick();
    expect(root.querySelector('[data-state="stopped"] pre code')?.textContent).toBe("a\nb");
    expect(controller.getSnapshot().messages.at(-1)?.content).toContain("```ts\na\nb");
    expect(errors).toEqual([]);
  } finally { controller.stop(); await completed; app.unmount(); root.remove(); controller.destroy(); }
});

it("shows host configuration guidance without offering personal provider settings", async () => {
  const fixture = createChatFixture();
  const controller = createAiChatController({ ...fixture.options, providerStatus: {
    state: "local", label: { "zh-CN": "请联系管理员配置团队模型。", en: "Ask your administrator to configure team models." }
  } });
  const root = document.createElement("div"); document.body.append(root);
  const app = createApp({ render: () => h(Workspace, { controller, locale: "zh-CN" }) });
  app.mount(root);
  try {
    await nextTick();
    expect(root.textContent).toContain("请联系管理员配置团队模型。");
    expect(root.querySelector('[aria-label="配置 AI 连接"]')).toBeNull();
    expect(root.textContent).not.toContain("请在应用设置中配置模型连接");
  } finally { app.unmount(); root.remove(); await controller.destroy(); }
});
