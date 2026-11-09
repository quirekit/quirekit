import type { WordParagraphFormatting, WordParagraphTabStop } from '@quirekit/classic-paragraph-model';

/**
 * Resolves one stored tab delta without flattening either persistent authority.
 * @param inherited - Effective custom stops from the preceding style layer.
 * @param delta - Current layer's ordered additions, replacements and exact clears.
 * @returns Sorted effective stops; absent or empty deltas keep inheriting.
 */
export function mergeWordParagraphTabs(
  inherited: WordParagraphFormatting['tabs'],
  delta: WordParagraphFormatting['tabs'] | undefined,
): WordParagraphFormatting['tabs'] {
  if (!delta?.length) return inherited;
  const positions = new Map<string, WordParagraphTabStop>();
  // Source layers remain immutable. Clear consumes an exact custom position;
  // it never becomes layout geometry or erases the separate document grid.
  for (const stop of [...(inherited ?? []), ...delta]) {
    const key = `${stop.position.unit}:${stop.position.value}`;
    if (stop.alignment === 'clear') positions.delete(key);
    else positions.set(key, stop);
  }
  return [...positions.values()].sort((left, right) =>
    left.position.unit.localeCompare(right.position.unit) || left.position.value - right.position.value);
}
