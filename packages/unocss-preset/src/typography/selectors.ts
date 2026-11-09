/**
 * Splits a selector list authored by the recipes.
 * @param elements - Trusted list without commas inside functional pseudo-classes.
 * @returns Trimmed alternatives in source order.
 */
export function selectorAlternatives(elements: string): string[] {
  return elements.split(",").map(selector => selector.trim());
}

/**
 * Builds zero-specificity defaults for a `@scope` root and its descendants.
 * Each `:where()` holds one keyed alternative because browsers try a multi-argument
 * `:is()` or `:where()`, and a leading `:scope`, against every element in the document.
 * @param alternatives - Compound selectors starting with a tag or attribute.
 * @param suffix - Pseudo-class or pseudo-element shared by every alternative.
 * @returns A selector list for the rule prelude.
 */
export function scopedElementSelector(alternatives: readonly string[], suffix = ""): string {
  return alternatives.flatMap(selector => [`:where(${selector}:scope)${suffix}`, `:where(${selector})${suffix}`]).join(", ");
}
