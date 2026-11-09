import { createTypographyElementCss } from "./elements";
import { scopedElementSelector, selectorAlternatives } from "./selectors";

/** Opt-in native styling; explicit islands stop descendant matching, not CSS inheritance. */
export const typographySemanticCss = `
@scope (.qk-typography) to ([data-qk-not-typography], [data-qk-not-prose]) {
${createTypographyElementCss(elementSelector)}
}
`;

/**
 * Covers both a standalone semantic root and native content in its scope.
 * @param elements - Comma-separated native element selectors.
 * @returns Zero-specificity defaults that allow explicit visual-role overrides.
 */
function elementSelector(elements: string): string {
  return scopedElementSelector(selectorAlternatives(elements));
}
