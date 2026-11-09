// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { modeFacet } from "@quirekit/msfe-core/state";
import { hasStructure, htmlToMarkdown } from "./html";
import { fitPastedText } from "./handler";

describe("pasted HTML", () => {
  it.each([
    ["<h2>标题</h2><p>一段<b>粗体</b>和<a href=\"http://a.b\">链接</a></p>", "## 标题\n\n一段**粗体**和[链接](http://a.b)"],
    ["<ul><li>甲<ul><li>子</li></ul></li><li>乙</li></ul>", "- 甲\n  - 子\n- 乙"],
    ["<ol start=\"3\"><li>三</li><li>四</li></ol>", "3. 三\n4. 四"],
    ["<blockquote><p>引一</p><p>引二</p></blockquote>", "> 引一\n>\n> 引二"],
    ["<pre><code>let a = *1*;</code></pre>", "```\nlet a = *1*;\n```"],
    ["<table><tr><th>名</th><th>值</th></tr><tr><td>a|b</td><td>1</td></tr></table>", "| 名 | 值 |\n| --- | --- |\n| a\\|b | 1 |"],
    ["<p>2*3*4 和 _下_</p>", "2\\*3\\*4 和 \\_下\\_"],
    ["<p><i> 斜 </i>后</p>", "*斜* 后"],
    ["<script>alert(1)</script><p>正文</p>", "正文"],
    ["<p><a href=\"javascript:alert(1)\">点</a></p>", "点"],
  ])("converts %s", (html, expected) => expect(htmlToMarkdown(html)).toBe(expected));

  it("takes plain text for HTML without structure", () => {
    expect(hasStructure("<div><span style=\"color:red\">let</span> x</div>")).toBe(false);
    expect(hasStructure("<p>text</p>")).toBe(true);
  });
});

describe("pasted text fitted to its target", () => {
  /** @param source - Source with one ¦ caret. @returns Live state. */
  const at = (source: string) => {
    const state = EditorState.create({ doc: source.replace("¦", ""), selection: EditorSelection.cursor(source.indexOf("¦")),
      extensions: [markdown({ extensions: GFM }), modeFacet.of("live")] });
    ensureSyntaxTree(state, state.doc.length, 1000);
    return state;
  };

  it.each([
    ["| a | b |\n| - | - |\n| 1¦ | 2 |", "甲\n乙|丙", "甲 乙\\|丙"],
    ["- 前¦", "甲\n乙", "甲\n  乙"],
    ["> 前¦", "甲\n\n乙", "甲\n>\n> 乙"],
    ["- 前¦", "- 甲\n- 乙", "\n- 甲\n- 乙"],
    ["- 前\n- ¦", "- 甲\n- 乙", "甲\n- 乙"],
    ["```\na¦\n```", "x\n  y", "x\n  y"],
    ["段¦落", "甲\n乙", "甲\n乙"],
  ])("in %s", (source, text, expected) => expect(fitPastedText(text, at(source))).toBe(expected));
});
