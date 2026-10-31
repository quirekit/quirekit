// @vitest-environment happy-dom

import { createApp, h, nextTick, ref, type Ref } from "vue";
import { describe, expect, it } from "vitest";
import type { AiChatAuthorizationMode } from "../types";
import AiChatAuthorizationSelect from "./authorization-select.vue";

describe("AI Chat authorization selector", () => {
  it("defaults to request approval and offers only request approval and full access", async () => {
    const mounted = await mountSelector("request-approval");
    expect(mounted.host.textContent).toContain("请求批准");
    mounted.host.querySelector<HTMLButtonElement>(
      "[data-ai-authorization-trigger=true]"
    )?.click();
    await nextTick();
    const items = [...document.body.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]")].map(button => button.textContent ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("请求批准");
    expect(items[1]).toContain("完全访问");
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]")[0]?.click();
    await nextTick();
    expect(mounted.mode.value).toBe("request-approval");
    mounted.unmount();
  });

  it("requires a second explicit action before enabling full access", async () => {
    const mounted = await mountSelector("request-approval");
    mounted.host.querySelector<HTMLButtonElement>(
      "[data-ai-authorization-trigger=true]"
    )?.click();
    await nextTick();
    const fullAccess = [...document.body.querySelectorAll<HTMLButtonElement>(
      "[role=menuitemradio]"
    )].find(button => button.textContent?.includes("完全访问"));
    fullAccess?.click();
    await nextTick();
    expect(mounted.mode.value).toBe("request-approval");
    expect(document.body.textContent).toContain("启用完全访问？");
    const enable = [...document.body.querySelectorAll<HTMLButtonElement>("button")]
      .find(button => button.textContent?.trim() === "启用");
    enable?.click();
    await nextTick();
    expect(mounted.mode.value).toBe("full-access");
    mounted.unmount();
  });
});

/** Mounted authorization selector fixture. */
interface MountedSelector {
  /** Host DOM. */
  readonly host: HTMLElement;
  /** Reactive selected mode. */
  readonly mode: Ref<AiChatAuthorizationMode>;
  /** Releases Vue and DOM resources. */
  readonly unmount: () => void;
}

/**
 * Mounts the selector with a controlled model value.
 *
 * @param initial - Initial preset.
 * @returns Mounted controlled selector.
 */
async function mountSelector(initial: AiChatAuthorizationMode): Promise<MountedSelector> {
  const mode = ref<AiChatAuthorizationMode>(initial);
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({
    render: () => h(AiChatAuthorizationSelect, {
      locale: "zh-CN",
      modelValue: mode.value,
      disabled: false,
      "onUpdate:modelValue": (value: AiChatAuthorizationMode) => {
        mode.value = value;
      }
    })
  });
  app.mount(host);
  await nextTick();
  return {
    host,
    mode,
    unmount() {
      app.unmount();
      host.remove();
    }
  };
}
