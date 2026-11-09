import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";
import QuireBlockHandle from "./block-handle.vue";
import { quireBlockToneColor } from "./presentation";

/** @param props - Handle props and fallthrough attributes. @returns Server-rendered HTML. */
function render(props: Record<string, unknown>): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(QuireBlockHandle, props as never) }));
}

describe("QuireBlockHandle", () => {
  it("colors only the type mark and keeps the grip muted", async () => {
    const html = await render({ label: "拖动", icon: "table", tone: "teal" });
    expect(html).toContain(`aria-label="拖动"`);
    expect(html).toMatch(/qk-block-handle__type[^>]*style="color:\s*color-mix/);
    expect(html).toMatch(/qk-block-handle__grip/);
  });

  it("prefers a text badge over the icon and forwards host attributes to the button", async () => {
    const html = await render({ label: "拖动", icon: "heading", badge: "H2", tone: "blue", "data-block-handle": "", "aria-haspopup": "menu" });
    expect(html).toContain(">H2<");
    expect(html).toMatch(/<button[^>]*data-block-handle/);
    expect(html).toMatch(/<button[^>]*aria-haspopup="menu"/);
  });

  it("falls back to a neutral mark", async () => {
    expect(await render({ label: "拖动", icon: "layers" })).toContain(quireBlockToneColor("neutral"));
  });
});
