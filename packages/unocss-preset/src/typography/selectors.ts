/**
 * Splits a selector list authored by the recipes.
 * @param elements - Trusted list without commas inside functional pseudo-classes.
 * @returns Trimmed alternatives in source order.
 */
export function selectorAlternatives(elements: string): string[] {
  return elements.split(",").map(selector => selector.trim());
}

/** Cascade layer for native element defaults. Nested in the recipe layer, it ranks below every recipe rule there. */
export const elementLayer = "qk-elements";

/**
 * Builds defaults for a `@scope` root and its descendants.
 * Each alternative stays a plain compound selector: WebKit files a rule under a tag or attribute only when that key
 * stands outside `:is()` and `:where()`, and matches the scope of every unfiled rule against each element.
 * @param alternatives - Compound selectors starting with a tag or attribute.
 * @param suffix - Pseudo-class or pseudo-element shared by every alternative.
 * @returns A selector list for the rule prelude.
 */
export function scopedElementSelector(alternatives: readonly string[], suffix = ""): string {
  return alternatives.flatMap(selector => [`${selector}:scope${suffix}`, `${selector}${suffix}`]).join(", ");
}

/**
 * Places scoped element defaults in the element layer, so recipes override them whatever their specificity.
 * @param css - Scoped rules for native elements.
 * @returns The rules wrapped in the element layer.
 */
export function elementLayerCss(css: string): string {
  return `@layer ${elementLayer} {\n${css}\n}`;
}
