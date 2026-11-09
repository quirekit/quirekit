// @vitest-environment happy-dom
import { createApp, h, nextTick } from "vue";
import { expect, it } from "vitest";
import Select from "./select.vue";

it("shows an item's shortcut beside its label without changing the label text", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const app = createApp({ setup: () => () => h(Select, { label: "Style", modelValue: "h1", open: true, portalled: false,
    items: [{ label: "Heading 1", value: "h1", shortcut: ["⌥", "⌘", "1"] }, { label: "Paragraph", value: "p" }] }) });
  app.mount(host); await nextTick(); await nextTick();
  try {
    const [first, second] = host.querySelectorAll(".qk-select__item");
    expect(first!.querySelector(".qk-select__item-label")?.textContent?.trim()).toBe("Heading 1");
    expect(first!.querySelector("kbd.qk-select__item-shortcut")?.textContent).toBe("⌥⌘1");
    expect(first!.querySelector("kbd")?.getAttribute("aria-label")).toBe("Option + Command + 1");
    expect(second!.querySelector("kbd")).toBeNull();
  } finally { app.unmount(); host.remove(); }
});
