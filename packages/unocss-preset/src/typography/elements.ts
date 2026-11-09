import { themeVariableReferences, type QuireKitTypographyElement, type QuireKitTypographyVariant } from "@quirekit/ui";
import { typographyDeclarations } from "./declarations";

/** Native hierarchy shares existing roles; inline emphasis inherits its context. */
const elementRoles: Readonly<Partial<Record<QuireKitTypographyElement, QuireKitTypographyVariant>>> = Object.freeze({
  div: "body", p: "body", h1: "pageTitle", h2: "sectionTitle",
  h3: "heading", h4: "heading", h5: "heading", h6: "heading",
  small: "helper", code: "code", pre: "code", kbd: "code", samp: "code"
});

/**
 * Builds shared native text defaults without document spacing or page geometry.
 * @param selector - Low-specificity selector for the current scope's elements.
 * @param contextSelector - Selector for relationships that must survive nested element scopes.
 * @returns Complete text roles and native inline semantics for either adapter.
 */
export function createTypographyElementCss(selector: (elements: string) => string, contextSelector = selector): string {
  return [
    ...Object.entries(elementRoles).map(([element, name]) => {
      const declarations = typographyDeclarations(themeVariableReferences.typography[name], name === "code");
      return `${selector(element)}{${Object.entries(declarations).map(([property, value]) => `${property}:${value};`).join("")}}`;
    }),
    `${selector("strong,b")}{font-weight:var(--qk-type-heading-font-weight);}`,
    `${selector("em,i,cite,dfn,var")}{font-style:italic;}`,
    `${selector("p,h1,h2,h3,h4,h5,h6,pre")}{margin:0;}`,
    `${selector("h1,h2,h3,h4,h5,h6")}{text-wrap:balance;overflow-wrap:anywhere;}`,
    `${selector("a")}{text-decoration-line:underline;text-underline-offset:.2em;overflow-wrap:anywhere;}`,
    `${selector("a:focus-visible")}{outline:none;background-color:var(--qk-color-surface-hover);text-decoration-line:underline;}`,
    // Highlighter yellow in every theme, softened on dark pages so light text stays readable; hosts override it through --qk-prose-mark-background.
    `${selector("mark")}{background-color:var(--qk-prose-mark-background, light-dark(rgba(255, 246, 122, 0.8), rgba(255, 214, 0, 0.32)));color:inherit;}`,
    `${selector("del,s")}{text-decoration-line:line-through;}`,
    `${selector("ins,u")}{text-decoration-line:underline;text-underline-offset:.2em;}`,
    `${selector("abbr[title],abbr[data-qk-abbr]")}{text-decoration-line:underline;text-decoration-style:dotted;text-underline-offset:.2em;}`,
    `${selector("abbr[data-qk-abbr]")}{cursor:help;}`,
    `${selector("abbr[data-qk-abbr]:focus-visible")}{outline:var(--qk-border-width-focus) solid var(--qk-color-border-focus);outline-offset:var(--qk-border-width-focus);}`,
    `${selector("sub,sup")}{position:relative;font-size:.75em;line-height:0;vertical-align:baseline;}`,
    `${selector("sub")}{bottom:-.25em;}`,
    `${selector("sup")}{top:-.5em;}`,
    `${selector("pre")}{max-width:100%;overflow-x:auto;white-space:pre;}`,
    `${selector("code,samp")}{overflow-wrap:anywhere;}`,
    `${contextSelector("h1 code,h2 code,h3 code,h4 code,h5 code,h6 code,h1 samp,h2 samp,h3 samp,h4 samp,h5 samp,h6 samp")}{font-size:1em;line-height:inherit;font-weight:inherit;letter-spacing:inherit;}`,
    `${contextSelector("pre code,pre samp")}{font:inherit;letter-spacing:inherit;white-space:pre;overflow-wrap:normal;}`
  ].join("\n");
}
