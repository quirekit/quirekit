// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, createSSRApp, defineComponent, h, nextTick, shallowRef } from "vue";
import { renderToString } from "vue/server-renderer";
import { Node, defineSource } from "@quirekit/msfe-core";
import { MarkdownStream } from "../index";
import { QuireMarkdown, withMarkdownReading } from "./index";

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

/** @param props - A public reader's inputs. @returns Semantic server HTML. */
async function render(props: Record<string, unknown>): Promise<string> {
  return renderToString(createSSRApp({ render: () => h(QuireMarkdown, props) }));
}

describe("public streaming Markdown", () => {
  it.each([false, true])("renders semantic SSR and safely hydrates with HTML %s", async htmlEnabled => {
    const content = '## Hello\n\n[link][ref]\n\n[ref]: /target\n\n<script>bad()</script>\n\nbefore <span id="note">**safe**</span> after\n\nbefore <div>block</div> after\n\n[outer <a href="/inner">inner</a>](/outer)';
    const html = await render({ content, html: htmlEnabled });
    expect(html.replace(/<!--.*?-->/gu, "")).toMatch(/<h2[^>]*>Hello<\/h2>/u); expect(html).toContain('href="/target"');
    if (!htmlEnabled) expect(html).toContain("&lt;script&gt;");
    const root = document.createElement("div"); root.innerHTML = html; document.body.append(root);
    const error = vi.spyOn(console, "error"), warn = vi.spyOn(console, "warn");
    const app = createSSRApp({ render: () => h(QuireMarkdown, { content, html: htmlEnabled }) });
    cleanup.push(() => { app.unmount(); root.remove(); }); app.mount(root); await nextTick();
    expect(root.querySelector("script")).toBeNull(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
  });

  it("renders a line break tag without the HTML opt-in and keeps other tags as source", async () => {
    const html = await render({ content: "| a | b |\n| --- | --- |\n| 一<br>二 | <b>三</b> |\n\n甲<br/>乙" });
    expect(html.match(/<br[\s>]/gu)).toHaveLength(2);
    expect(html).toContain("&lt;b&gt;");
  });

  it("overrides elements without reparsing or losing an open code body", async () => {
    const content = shallowRef("[link](/target)\n\n```ts\none\ntwo"), status = shallowRef("receiving");
    const components = shallowRef({});
    const root = document.createElement("div"), app = createApp({ render: () => h(QuireMarkdown, {
      content: content.value, status: status.value as "receiving", components: components.value,
    }) });
    cleanup.push(() => app.unmount()); app.mount(root); await nextTick();
    expect(root.querySelector("pre code")?.textContent).toBe("one\ntwo");
    const advance = vi.spyOn(MarkdownStream.prototype, "advance");
    components.value = { a: defineComponent({ props: ["href"], setup: (props, { slots }) => () => h("a", { href: props.href, "data-custom": "yes" }, slots.default?.()) }) };
    status.value = "stopped"; await nextTick();
    expect(root.querySelector("a")?.getAttribute("data-custom")).toBe("yes"); expect(advance).not.toHaveBeenCalled();
    content.value += "\n```\n\nnext"; await nextTick();
    expect(root.querySelector("pre code")?.textContent).toBe("one\ntwo");
  });

  it("uses the same source grammar and validated fields for a custom node", async () => {
    const Badge = Node.create({ name: "badge", addAttributes: () => ({ value: { validate: value => value === "ok" } }),
      addSource: () => defineSource<{ value: string }>({ nodes: ["Badge"], syntax: { name: "Badge", open: "[[", close: "]]" },
        read: (document, node) => ({ value: document.slice(node.from + 2, node.to - 2) }), patch: () => null }),
    });
    const extension = withMarkdownReading(Badge, { render: ({ attrs }) => h("b", { "data-badge": "" }, String(attrs.value)) });
    const html = await render({ content: "[[ok]] [[bad]] `[[ok]]` [[open", options: { extensions: [extension] } });
    expect(html).toContain("data-badge"); expect(html).toContain("[[bad]]"); expect(html).toContain("[[open");
    expect(html.replace(/<!--.*?-->/gu, "")).toMatch(/<code[^>]*>\[\[ok\]\]<\/code>/u);
  });

  it("opts into sanitized block and inline HTML while leaving code inert", async () => {
    const html = await render({ html: true, content: '<div onclick="bad()"><strong>safe</strong><script>bad()</script><a href="jav&#x61;script:bad()">link</a></div>\n\ninline <span title="ok">**bold**</span> end\n\n`<b>code</b>`' });
    expect(html).toContain("<strong"); expect(html).toContain("safe"); expect(html).toContain('title="ok"');
    expect(html.replace(/<!--.*?-->/gu, "")).toMatch(/<strong[^>]*>bold<\/strong>/u);
    expect(html).not.toContain("onclick"); expect(html).not.toContain("<script"); expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;b&gt;code&lt;/b&gt;");
  });
});
