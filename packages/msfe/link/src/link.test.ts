// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createMsfeEditor, type MsfeEditor } from "@quirekit/msfe-core";
import { link } from "./link";
import { textLinks } from "./text/extension";
import { linkifyTextLinks } from "./text/export";

const editors: MsfeEditor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); });

describe("link references", () => {
  it("marks links the host recognizes as references, leaving other links and the source unchanged", () => {
    const markdown = "见 [支付设计](</d/abc>) 与 [官网](https://example.com)";
    const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), markdown, mode: "live",
      extensions: [link({ reference: url => url.startsWith("/d/") ? "document" : null })] });
    editors.push(editor);
    const anchors = [...editor.element.querySelectorAll<HTMLAnchorElement>("a.msfe-link")];
    expect(anchors.map(anchor => [anchor.textContent, anchor.dataset.msfeReference ?? null, anchor.classList.contains("msfe-link-reference")]))
      .toEqual([["支付设计", "document", true], ["官网", null, false]]);
    expect(editor.getMarkdown()).toBe(markdown);
  });
});

describe("export destinations", () => {
  it("rewrites inline and reference link destinations on export, leaving images, code and the source unchanged", async () => {
    const markdown = "见 [设计](</d/abc>) 与 [方案][ref]、[官网](https://example.com)，CLOUD-1 修复。\n\n![图](/d/img.png) `[x](/d/code)`\n\n[ref]: /d/xyz \"标题\"";
    const editor = createMsfeEditor({ parent: document.body.appendChild(document.createElement("div")), markdown, mode: "live",
      extensions: [link({ exportHref: url => url.startsWith("/d/") ? `https://docs.example${url}` : null }),
        textLinks({ id: "issues", pattern: /CLOUD-\d+/u, href: text => `https://issues.example/${text}`, exportLinks: true })] });
    editors.push(editor);
    expect(await linkifyTextLinks(editor.state)).toBe("见 [设计](https://docs.example/d/abc) 与 [方案][ref]、[官网](https://example.com)，[CLOUD-1](https://issues.example/CLOUD-1) 修复。"
      + "\n\n![图](/d/img.png) `[x](/d/code)`\n\n[ref]: https://docs.example/d/xyz \"标题\"");
    expect(editor.getMarkdown()).toBe(markdown);
  });
});
