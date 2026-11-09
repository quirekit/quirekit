import { selectorAlternatives } from "../../typography/selectors";

/**
 * Pairs each native selector with its editor role so every alternative stays a simple key.
 * @param elements - Trusted list of single compound selectors starting with a tag.
 * @returns Native and `data-qk-prose` alternatives in source order.
 */
export function proseElementAlternatives(elements: string): string[] {
  return selectorAlternatives(elements).flatMap(element => [
    element,
    element.replace(/^[a-z][a-z0-9]*/u, tag => `[data-qk-prose="${tag}"]`)
  ]);
}

/**
 * Finds the elements a list of contextual selectors can style.
 * @param elements - Trusted relationships such as `pre code` or `h1 > a:hover`.
 * @returns Each distinct subject tag with its editor role.
 */
export function proseSubjectAlternatives(elements: string): string[] {
  const tags = selectorAlternatives(elements).map(selector => /^[a-z][a-z0-9]*/u.exec(selector.split(/[ >+~]+/u).at(-1) ?? "")?.[0] ?? "");
  return [...new Set(tags)].filter(Boolean).flatMap(tag => [tag, `[data-qk-prose="${tag}"]`]);
}

/**
 * Native content and editor-owned blocks consume one semantic stylesheet.
 * @param elements - Trusted native selector list authored by the Prose recipe.
 * @returns The same relationships, including explicit non-native Prose roles.
 */
export function proseElements(elements: string): string {
  return elements.replace(/(^|[ ,>+~])([a-z][a-z0-9]*)/gu, '$1:is($2, [data-qk-prose="$2"])');
}
