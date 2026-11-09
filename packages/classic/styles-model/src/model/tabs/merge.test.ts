import { expect, it } from 'vitest';
import { defaultWordParagraphFormatting, resolveWordParagraphFormatting, type WordParagraphTabStop } from '@quirekit/classic-paragraph-model';
import { createDefaultWordParagraphStyleRegistry } from '../defaults';
import { mergeWordParagraphFormatting } from '../merge';
import { resolveWordParagraphAppearance } from '../resolve';

/** @param position - Physical source twips. @param alignment - Native stop or exact-position removal. @returns One canonical tab operation. */
function stop(position: number, alignment: WordParagraphTabStop['alignment'] = 'start'): WordParagraphTabStop {
  return { position: { unit: 'dxa', value: position }, alignment };
}

it('merges style layers and direct tabs by position without changing the stored authorities', () => {
  const base = createDefaultWordParagraphStyleRegistry(), normal = base.styles.Normal!;
  const registry = { ...base, styles: { ...base.styles,
    TabBase: { ...normal, id: 'TabBase', basedOn: 'Normal', default: false, paragraph: { tabs: [stop(1440), stop(2880)] } },
    TabChild: { ...normal, id: 'TabChild', basedOn: 'TabBase', default: false, paragraph: { tabs: [stop(1440, 'clear'), stop(2160)] } },
  } };
  const direct = resolveWordParagraphFormatting({ styleId: 'TabChild', tabs: [stop(1440, 'end')] });
  const original = JSON.parse(JSON.stringify({ registry, direct }));
  expect(resolveWordParagraphAppearance(registry, direct).paragraph.tabs).toEqual([stop(1440, 'end'), stop(2160), stop(2880)]);
  expect({ registry, direct }).toEqual(original);
  expect(resolveWordParagraphAppearance(registry, resolveWordParagraphFormatting({ styleId: 'TabChild' })).paragraph.tabs)
    .toEqual([stop(2160), stop(2880)]);
});

it('preserves inherited positions through null and empty deltas and clears only explicit positions', () => {
  const inherited = { ...defaultWordParagraphFormatting, tabs: [stop(720), stop(1440)] };
  for (const tabs of [undefined, null, []]) expect(mergeWordParagraphFormatting(inherited, { tabs }).tabs).toEqual(inherited.tabs);
  expect(mergeWordParagraphFormatting(inherited, { tabs: [stop(999, 'clear'), stop(720, 'clear')] }).tabs).toEqual([stop(1440)]);
  expect(mergeWordParagraphFormatting(inherited, { tabs: [stop(720, 'clear'), stop(1440, 'clear')] }).tabs).toEqual([]);
});

it('replaces the whole tuple at one position and uses final local writes', () => {
  const inherited = { ...defaultWordParagraphFormatting, tabs: [{ ...stop(720), leader: 'dot' }] };
  expect(mergeWordParagraphFormatting(inherited, { tabs: [stop(720, 'center')] }).tabs).toEqual([stop(720, 'center')]);
  expect(mergeWordParagraphFormatting(inherited, { tabs: [stop(720, 'clear'), stop(720, 'end')] }).tabs).toEqual([stop(720, 'end')]);
  expect(mergeWordParagraphFormatting(inherited, { tabs: [stop(720), stop(720, 'clear')] }).tabs).toEqual([]);
});

it('retains unsupported unit identity instead of equating it to physical twips', () => {
  const inherited = { ...defaultWordParagraphFormatting, tabs: [{ ...stop(720), position: { unit: 'character' as const, value: 720 } }] };
  expect(mergeWordParagraphFormatting(inherited, { tabs: [stop(720, 'clear')] }).tabs).toEqual(inherited.tabs);
});
