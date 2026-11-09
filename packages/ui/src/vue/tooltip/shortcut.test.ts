// @vitest-environment happy-dom
import { createApp, h, nextTick } from "vue";
import { expect, it } from "vitest";
import TooltipRoot from "./root.vue";
import TooltipTrigger from "./trigger.vue";
import TooltipContent from "./content.vue";

/** @param props - Content properties. @returns The open tooltip's content element. */
async function content(props: Record<string, unknown>): Promise<HTMLElement> {
  const host = document.createElement("div"); document.body.append(host);
  const app = createApp({ render: () => h(TooltipRoot, { open: true }, { default: () => [
    h(TooltipTrigger, { asChild: true }, () => h("button", "Bold")), h(TooltipContent, { portalled: false, ...props }),
  ] }) });
  app.mount(host); await nextTick(); await nextTick();
  return host.querySelector<HTMLElement>('[data-part="content"]')!;
}

it("shows a chord after the explanation and hides it behind a disabled reason", async () => {
  const mac = await content({ content: "Bold", shortcut: ["⇧", "⌘", "B"] });
  expect(mac.textContent).toContain("Bold");
  expect(mac.querySelector("kbd.qk-tooltip__shortcut")?.textContent).toBe("⇧⌘B");
  expect(mac.querySelector("kbd")?.getAttribute("aria-label")).toBe("Shift + Command + B");
  const other = await content({ content: "Bold", shortcut: ["Ctrl", "B"] });
  expect(other.querySelector("kbd")?.textContent).toBe("Ctrl+B");
  const disabled = await content({ content: "Bold", shortcut: ["Ctrl", "B"], subjectDisabled: true, disabledReason: "Select text" });
  expect(disabled.querySelector("kbd")).toBeNull();
});
