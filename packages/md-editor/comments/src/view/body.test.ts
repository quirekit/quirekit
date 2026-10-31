import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { CommentBody } from "./body";

/** @param body - Comment Markdown. @returns Rendered HTML. */
const render = (body: string) => renderToString(createSSRApp({ render: () => h(CommentBody, { body }) }));

describe("comment body", () => {
  it("renders inline formatting, safe links and mentions", async () => {
    const html = await render("请 **确认** *时间*，`v2` 与 ~~旧版~~，见 [文档](https://example.test/a?b=1&amp;c=2) 和 [@小林](<#member-lin>)");
    expect(html).toContain("<strong>确认</strong>");
    expect(html).toContain("<em>时间</em>");
    expect(html).toContain("<code>v2</code>");
    expect(html).toContain("<s>旧版</s>");
    expect(html).toContain('href="https://example.test/a?b=1&amp;c=2"');
    expect(html).toContain('class="md-comment-mention"');
    expect(html).toContain(">@小林</a>");
  });

  it("keeps unsafe links, images, HTML and block syntax as text", async () => {
    const html = await render("# 标题\n\n[点我](javascript:alert(1)) ![图](x.png) <b>粗</b>\n\n- 列表");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("点我");
    expect(html).toContain("![图](x.png)");
    expect(html).toContain("&lt;b&gt;粗&lt;/b&gt;");
    expect(html).toContain("- 列表");
    expect(html).not.toContain("<img");
  });
});
