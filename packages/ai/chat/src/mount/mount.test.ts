// @vitest-environment happy-dom
import { createTheme } from "@quirekit/ui";
import { nextTick } from "vue";
import { expect, it, vi } from "vitest";
import { mountAiChatWorkspace } from "./mount";
import type { AiChatController } from "../types";

vi.mock("../vue/workspace.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return { default: defineComponent({
    props: { locale: { type: String, required: true } },
    emits: ["close"],
    setup: (props, { emit }) => () => h("button", {
      "data-ai-mount-fixture": "",
      onClick: () => emit("close")
    }, props.locale)
  }) };
});

it("applies theme and locale updates and routes close to the latest host handler", async () => {
  const initialTheme = createTheme({ sources: { primary: "#246b55" } });
  const nextTheme = createTheme({ scheme: "dark", sources: { primary: "#8246ab" } });
  const firstClose = vi.fn();
  const nextClose = vi.fn();
  const mounted = mountAiChatWorkspace({
    ownerDocument: document, controller: {} as AiChatController,
    theme: initialTheme, locale: "zh-CN", onClose: firstClose
  });
  document.body.append(mounted.element);
  try {
    const themeSurface = mounted.element.querySelector<HTMLElement>("[data-qk-theme-surface]")!;
    expect(themeSurface.style.getPropertyValue("--qk-color-selection-document")).toBe(initialTheme.color.selection.document);
    const button = mounted.element.querySelector<HTMLButtonElement>("[data-ai-mount-fixture]")!;
    expect(button.textContent).toBe("zh-CN");
    mounted.update({ theme: nextTheme, locale: "en", onClose: nextClose });
    await nextTick();
    expect(button.textContent).toBe("en");
    expect(themeSurface.style.getPropertyValue("--qk-color-selection-document")).toBe(nextTheme.color.selection.document);
    button.click();
    expect(nextClose).toHaveBeenCalledOnce();
    expect(firstClose).not.toHaveBeenCalled();
  } finally {
    mounted.destroy();
  }
  expect(document.querySelector("[data-ai-mount-fixture]")).toBeNull();
});
