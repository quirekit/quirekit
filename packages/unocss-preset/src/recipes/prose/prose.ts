import type { StaticShortcut } from "@unocss/core";
import { themeVariableReferences } from "@quirekit/ui";
import { inlineCodeDeclarations, typographyDeclarations } from "../../typography/declarations";
import { proseCompositionShortcuts } from "./compositions";
import { createTypographyElementCss } from "../../typography/elements";
import { elementLayer, scopedElementSelector, selectorAlternatives } from "../../typography/selectors";
import { proseElementAlternatives, proseElements, proseSubjectAlternatives } from "./selectors";
import { proseContainerCss } from "./container";
import { proseHighlightCss } from "./highlight";

/** Root geometry and text are stable even when the host has no typography reset. */
export const proseShortcuts: StaticShortcut[] = [
  ...proseCompositionShortcuts,
  ["qk-prose", ["flow-root min-w-0 max-w-full text-qk-text-primary", typographyDeclarations(themeVariableReferences.typography.body, false)], { layer: "qk-recipes" }]
];
/** Public root selector for discovery and standalone stylesheets. */
export const proseRecipeCatalog = Object.freeze(["qk-prose", "qk-prose--compact", "qk-prose--table-content", "qk-prose-node", "qk-prose-table", "qk-prose-task-marker",
  "qk-prose-container", "qk-prose-container__header", "qk-prose-container__body", "qk-prose-highlight-icon", "qk-prose-highlight-swatch",
  ...proseCompositionShortcuts.map(shortcut => shortcut[0] as string)]);

/**
 * @param elements - Native tags or states.
 * @param suffix - Pseudo-class or pseudo-element shared by every element.
 * @returns Defaults for both a scope root and its descendants.
 */
function nodeSelector(elements: string, suffix?: string): string {
  return scopedElementSelector(proseElementAlternatives(elements), suffix);
}

/**
 * @param elements - Native tags only, excluding editor blocks that borrow a role through data-qk-prose.
 * @returns Scope-root and descendant selectors that also outrank the role selector on a native tag carrying a role.
 */
function nativeSelector(elements: string): string {
  return scopedElementSelector(selectorAlternatives(elements).flatMap(tag => [tag, `${tag}[data-qk-prose]`]));
}

/**
 * Native relationships outrank a nested node's defaults while remaining below recipes and utility classes.
 * The leading subject lets browsers skip elements that cannot match.
 * @param elements - Contextual native selectors, such as pre code or ol ol.
 * @returns Selectors preserving document context across nested component scopes.
 */
function contextSelector(elements: string): string {
  const roles = proseElements(elements);
  return proseSubjectAlternatives(elements).flatMap(subject => [`${subject}:scope:is(${roles})`, `${subject}:is(${roles})`]).join(", ");
}

/**
 * Document rhythm augments shared semantic text. Element components inherit their
 * article's density; a nested article or UI island starts its own spacing context.
 */
export const proseStaticCss = `
${proseContainerCss}
${proseHighlightCss}
.qk-prose, [data-qk-not-prose], [data-qk-not-typography] {
  --qk-prose-block-space:var(--qk-space-surface);
  --qk-prose-heading-space:var(--qk-space-section);
  --qk-prose-list-space:var(--qk-space-inline);
  --qk-prose-list-indent:1.5em;
  --qk-prose-table-width:100%;
}
.qk-prose--table-content { --qk-prose-table-width:auto; }
.qk-prose--compact {
  --qk-prose-block-space:calc(var(--qk-space-surface) / 2);
  --qk-prose-heading-space:var(--qk-space-surface);
  --qk-prose-list-space:var(--qk-space-inline-tight);
}
/* Public Checkbox composition: one text line, without form-row padding or a hidden label gap. */
.qk-prose-task-marker.qk-checkbox {
  --qk-control-size-line-height:1lh;
  font:inherit;
  inline-size:var(--qk-prose-list-indent, 1.5em);
  block-size:1lh;
  min-block-size:0;
  padding-block:0;
  gap:0;
  vertical-align:top;
}
.qk-prose-image + .qk-prose-image { margin-block-start:var(--qk-space-surface); }
/* Scroll frame for a native table: the table fills or hugs the frame; columns keep five characters, as in the editor, and wider tables scroll here. */
.qk-prose-table { margin-block:var(--qk-prose-block-space, var(--qk-space-surface)); max-inline-size:100%; overflow-x:auto; }
.qk-prose-table:first-child { margin-block-start:0; }
.qk-prose-table:last-child { margin-block-end:0; }
.qk-prose-table:focus-visible { outline:var(--qk-border-width-focus) solid var(--qk-color-border-focus); outline-offset:var(--qk-border-width-focus); }
.qk-prose-table > table { margin-block:0; }
.qk-prose-table :is(th, td) { min-inline-size:calc(5em + 2 * var(--qk-space-surface-compact)); }
@layer ${elementLayer} {
@scope (.qk-prose, .qk-prose-node) to ([data-qk-not-prose], [data-qk-not-typography]) {
${createTypographyElementCss(nodeSelector, contextSelector)}
  ${nodeSelector("ul, ol, li, dl, dt, dd, blockquote, table, thead, tbody, tfoot, tr, th, td, figure")} { font-family:var(--qk-type-body-font-family); font-size:var(--qk-type-body-font-size); line-height:var(--qk-type-body-line-height); font-weight:var(--qk-type-body-font-weight); letter-spacing:var(--qk-type-body-letter-spacing); }
  ${nodeSelector("p, ul, ol, dl, blockquote, pre, table, figure")} { margin-block:var(--qk-prose-block-space, var(--qk-space-surface)); }
  ${nodeSelector("p, li, dd, th, td, figcaption")} { overflow-wrap:anywhere; }
  ${nodeSelector("h1, h2, h3, h4, h5, h6")} { margin-block:var(--qk-prose-heading-space, var(--qk-space-section)) var(--qk-prose-block-space, var(--qk-space-surface)); scroll-margin-block-start:var(--qk-space-surface); }
  ${nodeSelector("a")} { color:var(--qk-color-text-accent); }
  ${contextSelector("h1 > a, h2 > a, h3 > a, h4 > a, h5 > a, h6 > a")} { color:inherit; text-decoration:none; }
  ${contextSelector("h1 > a:hover, h1 > a:focus-visible, h2 > a:hover, h2 > a:focus-visible, h3 > a:hover, h3 > a:focus-visible, h4 > a:hover, h4 > a:focus-visible, h5 > a:hover, h5 > a:focus-visible, h6 > a:hover, h6 > a:focus-visible")} { text-decoration:underline; }
  ${nodeSelector("ul")} { list-style-type:disc; padding-inline-start:var(--qk-prose-list-indent); }
  ${nodeSelector("ol")} { list-style-type:decimal; padding-inline-start:var(--qk-prose-list-indent); }
  ${contextSelector("ul ul, ol ul")} { list-style-type:circle; }
  ${contextSelector("ul ul ul, ol ul ul, ul ol ul, ol ol ul")} { list-style-type:square; }
  ${contextSelector("ol ol, ul ol")} { list-style-type:lower-alpha; }
  ${contextSelector("ol ol ol, ul ol ol, ol ul ol, ul ul ol")} { list-style-type:lower-roman; }
  ${nodeSelector("li")} { margin-block:var(--qk-prose-list-space, var(--qk-space-inline)); }
  ${contextSelector("li > ul, li > ol, li > p")} { margin-block:var(--qk-prose-list-space, var(--qk-space-inline)); }
  ${nodeSelector("dt")} { font-weight:var(--qk-type-heading-font-weight); }
  ${nodeSelector("dt:not(:first-child)")} { margin-block-start:var(--qk-space-surface-compact); }
  ${nodeSelector("dd")} { margin-block-start:var(--qk-space-inline); margin-inline-start:var(--qk-space-surface); }
  ${nodeSelector("blockquote, figure")} { margin-inline:0; }
  ${nodeSelector("blockquote")} { position:relative; border-inline-start:0; padding-inline-start:calc(var(--qk-space-surface) + var(--qk-border-width-focus)); color:var(--qk-color-text-secondary); }
  ${nodeSelector("blockquote", "::before")} { content:""; position:absolute; inset-block:0; inset-inline-start:0; inline-size:var(--qk-border-width-focus); border-radius:var(--qk-radius-pill); background-color:var(--qk-color-border-default); pointer-events:none; }
  ${nodeSelector("code, kbd, samp")} { ${Object.entries(inlineCodeDeclarations).map(([property, value]) => `${property}:${value};`).join("")} }
  ${nodeSelector("pre")} { padding:var(--qk-space-surface); border-radius:var(--qk-radius-group); background:var(--qk-color-surface-subtle); }
  ${contextSelector("pre code, pre samp")} { padding:0; border:0; background:transparent; white-space:pre; overflow-wrap:normal; }
  ${nodeSelector("table")} { display:block; max-width:100%; overflow:auto; border-collapse:collapse; }
  ${nativeSelector("table")} { display:table; inline-size:var(--qk-prose-table-width, 100%); overflow:visible; }
  ${nodeSelector("th, td")} { border:var(--qk-border-width-default) solid var(--qk-color-border-subtle); padding:var(--qk-space-inline) var(--qk-space-surface-compact); text-align:start; vertical-align:top; }
  ${nodeSelector("th")} { font-weight:var(--qk-type-heading-font-weight); background:var(--qk-color-surface-subtle); }
  ${nodeSelector("figcaption, caption")} { font-family:var(--qk-type-helper-font-family); font-size:var(--qk-type-helper-font-size); line-height:var(--qk-type-helper-line-height); font-weight:var(--qk-type-helper-font-weight); letter-spacing:var(--qk-type-helper-letter-spacing); color:var(--qk-color-text-secondary); text-align:start; }
  ${nodeSelector("caption")} { padding-block-end:var(--qk-space-inline); }
  ${nodeSelector("figcaption")} { margin-block-start:var(--qk-space-inline); }
  ${nodeSelector("img, video, svg")} { max-width:100%; height:auto; }
  ${nodeSelector("audio")} { max-width:100%; }
  ${nodeSelector("hr")} { border:0; border-block-start:var(--qk-border-width-default) solid var(--qk-color-border-subtle); margin-block:var(--qk-space-group); }
  ${nodeSelector("p, h1, h2, h3, h4, h5, h6, ul, ol, dl, blockquote, pre, table, figure, hr", ":first-child")} { margin-block-start:0; }
  ${nodeSelector("p, h1, h2, h3, h4, h5, h6, ul, ol, dl, blockquote, pre, table, figure, hr", ":last-child")} { margin-block-end:0; }
}
}
`;
