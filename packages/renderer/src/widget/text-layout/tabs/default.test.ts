import { describe, expect, it } from 'vitest';
import { layoutQuireText } from '../layout';
import { resolveTextTab } from './resolve';
import type { QuireTextLayoutOptions } from '../types';

/** @param text - Authored source. @returns Fixed ten-pixel glyph layout. */
function options(text: string): QuireTextLayoutOptions {
  return { runs: [{ text, font: '16px test' }], maxWidth: 200, lineHeight: 24, baselineOffset: 18,
    measureText: value => ({ width: value.length * 10, height: 16 }), tabs: { stops: [], defaultInterval: 48 } };
}

describe('default paragraph tab grid', () => {
  it.each([[0, 48], [48, 48], [49, 47], [-20, 20], [190, 2], [198, 2]] as const)('advances from %s by %s', (position, advance) => {
    expect(resolveTextTab({ stops: [], defaultInterval: 48 }, position, 200, 100)).toEqual({ advance });
  });
  it('uses explicit alignment and leaders before the grid resumes from the same origin', () => {
    const tabs = { stops: [{ position: 70, alignment: 'end' as const, leader: '.' }], defaultInterval: 48 };
    expect(resolveTextTab(tabs, 10, 200, 20)).toEqual({ advance: 40, leader: '.' });
    expect(resolveTextTab(tabs, 70, 200, 20)).toEqual({ advance: 26 });
    expect(resolveTextTab({ stops: [] }, 70, 200, 20)).toBeUndefined();
  });
  it('keeps adjacent tabs as single source clusters at successive grid points', () => {
    const result = layoutQuireText(options('a\t\tB'));
    expect(result.clusters.map(cluster => ({ from: cluster.offset, x: cluster.x, advance: cluster.advance }))).toEqual([
      { from: 0, x: 0, advance: 10 }, { from: 1, x: 10, advance: 38 }, { from: 2, x: 48, advance: 48 }, { from: 3, x: 96, advance: 10 }
    ]);
    expect(result.visualRuns.filter(run => run.tab !== undefined).every(run => run.tab!.text === '')).toBe(true);
  });
  it('uses the unindented logical origin inside shifted flow slots', () => {
    const result = layoutQuireText({ ...options('a\tB'), maxWidth: 160, tabs: { stops: [], defaultInterval: 48, offset: 40 }, lineSlots: [[{ x: 20, width: 140 }]] });
    expect(result.clusters.at(-1)?.x).toBe(56);
  });
  it('retains one logical tab advance in an RTL paragraph', () => {
    const result = layoutQuireText({ ...options('א\tב'), baseDirection: 'rtl' });
    expect(result.clusters.find(cluster => cluster.offset === 1)?.advance).toBe(38);
    expect(result.clusters.map(cluster => cluster.offset).sort()).toEqual([0, 1, 2]);
  });
  it.each([[40, 30, 10], [-40, -60, 20], [-40, -20, 20]] as const)(
    'reaches the normal line origin %s from hanging position %s', (offset, position, advance) => {
      expect(resolveTextTab({ stops: [], defaultInterval: 48, offset }, position, 200, 10)).toEqual({ advance });
    }
  );
  it.each(['ltr', 'rtl'] as const)('uses the same paragraph edge for a %s hanging first line', baseDirection => {
    const result = layoutQuireText({ ...options('a\tB'), baseDirection, maxWidth: 160,
      tabs: { stops: [], defaultInterval: 48, offset: 40 }, lineSlots: [[{ x: baseDirection === 'ltr' ? -20 : 0, width: 180 }]] });
    expect(result.clusters.find(cluster => cluster.offset === 1)?.advance).toBe(10);
  });
  it('clips narrow slots without negative advances and resolves new source lines independently', () => {
    const result = layoutQuireText({ ...options('a\tB\n\tC'), maxWidth: 40 });
    expect(result.clusters.every(cluster => cluster.advance >= 0)).toBe(true);
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.visualRuns.filter(run => run.tab !== undefined).length).toBeLessThanOrEqual(2);
  });
  it.each([0, -1, Infinity, NaN])('rejects invalid interval %s before wrapping', defaultInterval => {
    expect(() => layoutQuireText({ ...options('a\tB'), tabs: { stops: [], defaultInterval } })).toThrow(RangeError);
  });
});
