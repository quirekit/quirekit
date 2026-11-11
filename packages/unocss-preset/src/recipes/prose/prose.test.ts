import { describe, expect, it } from "vitest";
import { createGenerator } from "@unocss/core";
import { defineQuireKitUnoConfig } from "../../preset/config";
import { generateQuireKitCss } from "../../output/css";
import { proseStaticCss } from "./prose";

/**
 * Splits a rule prelude at commas outside parentheses.
 * @param prelude - Selector list of one style rule.
 * @returns Each complex selector.
 */
function topLevelSelectors(prelude: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < prelude.length; index++) {
    const char = prelude[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) { selectors.push(prelude.slice(start, index)); start = index + 1; }
  }
  return [...selectors, prelude.slice(start)];
}

describe("Prose content recipes", () => {
  it("shares every heading and body role instead of embedding a second type scale", () => {
    expect(proseStaticCss).toContain('@scope (.qk-prose, .qk-prose-node) to ([data-qk-not-prose], [data-qk-not-typography])');
    for (const role of ['page-title', 'section-title', 'heading', 'body', 'helper', 'code']) {
      expect(proseStaticCss).toContain(`var(--qk-type-${role}-font-size)`);
      expect(proseStaticCss).toContain(`var(--qk-type-${role}-line-height)`);
    }
    expect(proseStaticCss).not.toMatch(/font-weight:\s*600|line-height:\s*1\.75|font-size:\s*1\.5em/u);
  });

  it("fills native tables by default, keeps editor table roles as blocks and scrolls wide tables in the frame", () => {
    expect(proseStaticCss).toContain('table:scope, table, table[data-qk-prose]:scope, table[data-qk-prose] { display:table; inline-size:var(--qk-prose-table-width, 100%);');
    expect(proseStaticCss).toContain('[data-qk-prose="table"] { display:block;');
    expect(proseStaticCss).toContain('.qk-prose--table-content { --qk-prose-table-width:auto; }');
    expect(proseStaticCss).toMatch(/\.qk-prose-table \{[^}]*overflow-x:auto;/u);
    expect(proseStaticCss).toContain('.qk-prose-table :is(th, td) { min-inline-size:calc(5em + 2 * var(--qk-space-surface-compact)); }');
  });

  it("starts every scoped selector with a plain tag or role inside the element layer", () => {
    const scoped = proseStaticCss.slice(proseStaticCss.indexOf("@layer qk-elements {\n@scope"));
    expect(scoped).toContain("@scope (.qk-prose, .qk-prose-node)");
    expect(scoped).not.toContain(":where(");
    const selectors = [...scoped.matchAll(/(?:\{|\})\s*([^{}@]+)\{/gu)].flatMap(match => topLevelSelectors(match[1]!));
    expect(selectors.length).toBeGreaterThan(200);
    for (const selector of selectors) expect(selector.trim()).toMatch(/^(?:[a-z][a-z0-9]*|\[data-qk-prose="[a-z0-9]+"\])(?![\w-])/u);
    expect(scoped).toContain('blockquote::before, [data-qk-prose="blockquote"]:scope::before, [data-qk-prose="blockquote"]::before {');
    expect(scoped).toContain('code:is(:is(pre, [data-qk-prose="pre"]) :is(code, [data-qk-prose="code"])');
    expect(scoped).toContain('[data-qk-prose="samp"]:scope:is(');
    expect(scoped).toContain('[data-qk-prose="hr"]:last-child { margin-block-end:0; }');
  });

  it("ships identical structural rules to UnoCSS and standalone consumers", async () => {
    const generator = await createGenerator(defineQuireKitUnoConfig({ defaultTokens: false }));
    const generated = await generator.generate('qk-prose qk-prose--compact');
    const standalone = await generateQuireKitCss();
    for (const css of [generated.css, standalone]) {
      expect(css).toContain(proseStaticCss);
      expect(css).toMatch(/\.qk-prose\{[^}]*font-family:var\(--qk-type-body-font-family\)/u);
      expect(css).toContain('list-style-type:circle');
      expect(css).toContain('list-style-type:lower-alpha');
      expect(css).toContain('margin-inline:0');
    }
  });
});
