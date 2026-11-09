import { describe, expect, it } from "vitest";
import { hasHtmlInteractiveLayoutStyles } from "./interaction-styles";

/** @param selectorText - CSS selector. @param properties - Declared property names. @returns Minimal CSSOM rule. */
function rule(selectorText: string, properties: string[]): CSSRule {
  return { selectorText, style: { length: properties.length, item: (index: number) => properties[index] } } as unknown as CSSRule;
}

/** @param rules - Stylesheet rules. @returns Root whose semantic subtree contains native paragraphs only. */
function root(rules: CSSRule[]): HTMLElement {
  return { ownerDocument: { styleSheets: [{ cssRules: rules }] }, parentElement: null,
    matches: (selector: string) => selector.includes(".document"),
    querySelector: (selector: string) => selector.includes("p") ? {} : null
  } as unknown as HTMLElement;
}

describe("native-flow interactive style dependencies", () => {
  it("ignores paint-only focus and unrelated control geometry", () => {
    expect(hasHtmlInteractiveLayoutStyles(root([
      rule(".document:focus p", ["color", "outline", "background-color"]),
      rule(".control:hover", ["transform"]), rule("p", ["font-size"])
    ]))).toBe(false);
  });
  it("includes layout changes under dynamic selectors, pseudo-elements and grouping rules", () => {
    for (const selector of ["p:hover", "p:not(:hover)", "p:focus::before", "[data-qk-modality=pointer] p", "[style*=cursor] p"]) {
      const group = { cssRules: [rule(selector, ["font-size"])] } as unknown as CSSRule;
      expect(hasHtmlInteractiveLayoutStyles(root([group]))).toBe(true);
    }
  });
  it("does not trust unreadable stylesheets or unsupported selectors", () => {
    const element = root([]);
    Object.defineProperty(element.ownerDocument.styleSheets[0], "cssRules", { get() { throw new Error("cross origin"); } });
    expect(hasHtmlInteractiveLayoutStyles(element)).toBe(true);
    const unsupported = root([rule("p:not(:has(:hover))", ["padding"])]);
    unsupported.querySelector = () => { throw new Error("selector"); };
    expect(hasHtmlInteractiveLayoutStyles(unsupported)).toBe(true);
  });
  it("retains interactive conditions declared by CSS scopes", () => {
    const scope = { cssText: "@scope (.document:hover) { p { transform: translateY(6px); } }",
      cssRules: [rule("p", ["transform"])] } as unknown as CSSRule;
    expect(hasHtmlInteractiveLayoutStyles(root([scope]))).toBe(true);
  });
  it("includes nested declarations following a grouping rule", () => {
    const nested = { style: { length: 1, item: () => "font-size" } };
    const parent = { ...rule("p:hover", []), cssRules: [nested] } as unknown as CSSRule;
    expect(hasHtmlInteractiveLayoutStyles(root([parent]))).toBe(true);
  });
});
