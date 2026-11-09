import { createGenerator } from "@unocss/core";
import { describe, expect, it } from "vitest";
import { defineQuireKitUnoConfig } from "../preset/config";
import { generateQuireKitCss } from "../output/css";

describe("opt-in HTML typography", () => {
  it("publishes complete semantic roles with explicit scope boundaries", async () => {
    const css = await generateQuireKitCss();
    expect(css).toContain('@scope (.qk-typography) to ([data-qk-not-typography], [data-qk-not-prose])');
    for (const [element, role] of [["h1", "page-title"], ["h2", "section-title"], ["h3", "heading"], ["h6", "heading"], ["p", "body"], ["small", "helper"], ["code", "code"]]) {
      const selector = `:where(${element}:scope), :where(${element})`;
      const declarations = css.split(`${selector}{`)[1]?.split("}")[0];
      for (const field of ["font-family", "font-size", "line-height", "font-weight", "letter-spacing"]) {
        expect(declarations, `${element}: ${field}`).toContain(`${field}:var(--qk-type-${role}-${field})`);
      }
      expect(declarations).not.toContain("color:");
    }
    expect(css).toContain('font-weight:var(--qk-type-heading-font-weight)');
    expect(css).toContain('text-decoration-line:line-through');
    expect(css).toContain('background-color:var(--qk-prose-mark-background, light-dark(rgba(255, 246, 122, 0.8), rgba(255, 214, 0, 0.32)))');
  });

  it("keeps defaults available without theme values or global tag rules", async () => {
    const generator = await createGenerator(defineQuireKitUnoConfig({ defaultTokens: false }));
    const { css } = await generator.generate("qk-typography qk-type-compact text-qk-text-secondary");
    expect(css).toContain('@scope (.qk-typography)');
    expect(css).toContain(".qk-type-compact{");
    expect(css).not.toContain("--qk-type-body-font-size:");
    expect(css).not.toMatch(/(?:^|\})h[1-6]\s*\{/u);
  });
});
