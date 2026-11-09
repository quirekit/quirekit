import { describe, expect, it, vi } from 'vitest';
import { Schema, type Node } from '@quirekit/pm';
import { createWordStylesParagraphModelSemantics } from './paragraph-model';

const schema = new Schema({ nodes: { doc: { content: 'paragraph+', attrs: { wordSettings: { default: null } } },
  paragraph: { content: 'text*', attrs: { wordParagraph: { default: null } } }, text: {} } });
const model = createWordStylesParagraphModelSemantics();

/** @param value - Stored document interval. @returns Real immutable paragraph owners for one document. */
function fixture(value: unknown) {
  const tab = schema.node('paragraph', null, schema.text('A\tB')), plain = schema.node('paragraph', null, schema.text('plain'));
  const doc = schema.node('doc', { wordSettings: { defaultTabStop: value } }, [tab, plain]);
  return { tab, plain, doc, context: model.styleContext(doc) };
}

describe('ordinary paragraph document default tabs', () => {
  it('projects the document interval only for a paragraph with authored Tab text', () => {
    const { tab, plain, context } = fixture(708);
    expect(model.resolveParagraph(tab, context, undefined).tabs).toEqual({ stops: [], defaultInterval: 708 / 15 });
    expect(model.resolveParagraph(plain, context, undefined).tabs).toBeUndefined();
    expect(model.resolveParagraph(plain, context, undefined).tabs).toBeUndefined();
  });
  it('invalidates tab geometry while retaining plain paragraph and typography signatures', () => {
    const { tab, plain, doc, context } = fixture(708);
    const changed = model.styleContext(schema.node('doc', { wordSettings: { defaultTabStop: 480 } }, doc.content));
    expect(changed.signature).not.toBe(context.signature);
    expect(model.resolveParagraph(tab, changed, undefined).signature).not.toBe(model.resolveParagraph(tab, context, undefined).signature);
    expect(model.resolveParagraph(plain, changed, undefined)).toEqual(model.resolveParagraph(plain, context, undefined));
    expect(model.styleTextSignature(tab, changed, undefined)).toBe(model.styleTextSignature(tab, context, undefined));
  });
  it('preserves unsupported explicit stops instead of silently activating the grid', () => {
    const { context } = fixture(480);
    const unsupported = schema.node('paragraph', { wordParagraph: { tabs: [{ position: { unit: 'dxa', value: 720 }, alignment: 'decimal' }] } }, schema.text('a\tb'));
    expect(model.resolveParagraph(unsupported, context, undefined).tabs).toBeUndefined();
  });
  it.each([null, 0, -1, '480', Infinity])('uses Word fallback for unusable canonical interval %s', value => {
    const { tab, context } = fixture(value);
    expect(model.resolveParagraph(tab, context, undefined).tabs).toEqual({ stops: [], defaultInterval: 48 });
  });
  it('keeps attribute-free documents on the original neutral path', () => {
    const context = model.styleContext({ attrs: {} } as never), { tab } = fixture(720);
    expect(context).toEqual({ token: undefined, signature: null });
    expect(model.resolveParagraph(tab, context, undefined).tabs).toBeUndefined();
  });
  it('scans changed paragraph content once and reuses the result across document snapshots', () => {
    const { tab, context } = fixture(720), child = vi.fn((index: number) => tab.child(index));
    const input = { attrs: tab.attrs, isText: false, childCount: tab.childCount, child } as unknown as Node;
    expect(model.resolveParagraph(input, context, undefined).tabs?.defaultInterval).toBe(48);
    expect(child).toHaveBeenCalledTimes(1);
    expect(model.resolveParagraph(input, fixture(480).context, undefined).tabs?.defaultInterval).toBe(32);
    expect(child).toHaveBeenCalledTimes(1);
  });
});
