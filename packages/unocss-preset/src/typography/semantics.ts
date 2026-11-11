import { createTypographyElementCss } from "./elements";
import { elementLayerCss, scopedElementSelector, selectorAlternatives } from "./selectors";

/** Opt-in native styling; explicit islands stop descendant matching, not CSS inheritance. */
export const typographySemanticCss = `
${elementLayerCss(`@scope (.qk-typography) to ([data-qk-not-typography], [data-qk-not-prose]) {
${createTypographyElementCss(elementSelector)}
}`)}
`;

/**
 * Covers both a standalone semantic root and native content in its scope.
 * @param elements - Comma-separated native element selectors.
 * @returns Element-layer defaults that explicit visual roles override.
 */
function elementSelector(elements: string): string {
  return scopedElementSelector(selectorAlternatives(elements));
}
