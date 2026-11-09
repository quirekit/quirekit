// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { Annotation, EditorSelection, EditorState, Compartment, Prec, StateEffect } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { markdown } from "@quirekit/cm-lang-markdown";
import { modeFacet, compositionEffect, compositionField } from "../../state/fields";
import { sourceRevealSetting } from "../../presentation/visibility";
import { inlineBoundaryNavigation } from "../../presentation/inline/navigation";
import { editingBoundaries } from "./runtime";
import type { EditingBoundaryRule } from "./types";

const source = 'previous\n\nHEADER\nbody\nFOOTER\n\nnext';
const from = source.indexOf('HEADER'), contentFrom = source.indexOf('body'), contentTo = contentFrom + 4, to = source.indexOf('FOOTER') + 6;
const rule: EditingBoundaryRule = { nodes: ['Document'], resolve: ({ state }) => {
  const text = state.doc.toString(), from = text.indexOf('HEADER'), end = text.indexOf('FOOTER');
  return from < 0 || end < 0 ? null : { from, to: end + 6, contentFrom: from + 7, contentTo: end - 1, kind: 'block', deletion: 'protect' };
} };

/** @param anchor - Initial canonical selection. @returns A custom non-Markdown shell proving feature-neutral behavior. */
function fixture(anchor = contentFrom) {
  return EditorState.create({ doc: source, selection: { anchor }, extensions: [markdown(), modeFacet.of('live'), compositionField,
    sourceRevealSetting.extension(() => 'hidden'), editingBoundaries([rule])] });
}

let view: EditorView | undefined;
afterEach(() => { view?.destroy(); view = undefined; });

it('uses the same owner for direct placement, navigation and both delete directions', () => {
  const state = fixture();
  expect(state.update({ selection: { anchor: from + 2 } }).state.selection.main.head).toBe(contentFrom);
  expect(state.update({ selection: { anchor: from + 2 }, userEvent: 'select' }).state.selection.main.head).toBe(from - 1);
  for (const [position, from, to, event] of [[contentFrom, contentFrom - 1, contentFrom, 'delete.backward'],
    [contentTo, contentTo, contentTo + 1, 'delete.forward']] as const) {
    const selected = state.update({ selection: { anchor: position } }).state;
    const edited = selected.update({ changes: { from, to }, selection: { anchor: from }, userEvent: event }).state;
    expect(edited.doc.toString()).toBe(source);
    expect(edited.selection.main.head).not.toBe(position);
  }
});

it('keeps the unselected block shell during a cross-boundary replacement', () => {
  const state = fixture().update({ selection: EditorSelection.single(2, contentFrom + 2) }).state;
  const edited = state.update({ ...state.replaceSelection('X'), userEvent: 'input.paste' }).state;
  expect(edited.doc.toString()).toBe('prX\n\nHEADER\ndy\nFOOTER\n\nnext');
});

it.each(['A', '中文', '😀'])('places the caret after replacement %s before accepting the next typed character', text => {
  for (const reverse of [false, true]) {
    const start = contentFrom + 1, end = source.indexOf('next') + 2;
    const state = fixture().update({ selection: EditorSelection.single(reverse ? end : start, reverse ? start : end) }).state;
    const first = state.update({ ...state.replaceSelection(text), userEvent: 'input.type' }).state;
    expect(first.doc.toString()).toBe(`previous\n\nHEADER\nb${text}\nFOOTER\nxt`);
    expect(first.selection.main.head).toBe(start + text.length);
    const second = first.update({ ...first.replaceSelection('B'), userEvent: 'input.type' }).state;
    expect(second.doc.toString()).toBe(`previous\n\nHEADER\nb${text}B\nFOOTER\nxt`);
  }
});

it('accepts protected native text replacement before the browser merges projected block DOM', () => {
  view = new EditorView({ state: fixture().update({ selection: EditorSelection.single(contentFrom + 1, source.indexOf('next') + 2) }).state,
    parent: document.body });
  const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: '中文' });
  view.contentDOM.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(view.state.doc.toString()).toBe('previous\n\nHEADER\nb中文\nFOOTER\nxt');
  expect(view.state.selection.main.head).toBe(contentFrom + 3);
});

it('leaves composing and noncancelable native input with its platform owner', () => {
  view = new EditorView({ state: fixture().update({ selection: EditorSelection.single(contentFrom + 1, source.indexOf('next') + 2) }).state,
    parent: document.body });
  for (const options of [{ cancelable: false }, { cancelable: true, isComposing: true }]) {
    const event = new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: '中', ...options });
    view.contentDOM.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(view.state.doc.toString()).toBe(source);
  }
});

it('keeps host change filters authoritative for protected native replacements', () => {
  const state = fixture().update({ selection: EditorSelection.single(contentFrom + 1, source.indexOf('next') + 2),
    effects: StateEffect.appendConfig.of(EditorState.changeFilter.of(() => false)) }).state;
  view = new EditorView({ state, parent: document.body });
  const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: 'X' });
  view.contentDOM.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(view.state.doc.toString()).toBe(source);
});

it('allows complete selection and explicit command edits, but not ordinary source-shell input', () => {
  const state = fixture().update({ selection: EditorSelection.single(0, source.length) }).state;
  expect(state.update({ ...state.replaceSelection('replacement'), userEvent: 'input.type' }).state.doc.toString()).toBe('replacement');
  const selected = fixture();
  expect(selected.update({ changes: { from: from + 1, insert: 'X' } }).state.doc.toString()).toContain('HXEADER');
});

it('preserves source and IME ownership and normalizes when the source mode ends', () => {
  const mode = new Compartment();
  const state = EditorState.create({ doc: source, selection: { anchor: from + 1 }, extensions: [markdown(), mode.of(modeFacet.of('source')),
    compositionField, sourceRevealSetting.extension(() => 'hidden'), editingBoundaries([rule])] });
  expect(state.update({ selection: { anchor: from + 1 } }).state.selection.main.head).toBe(from + 1);
  expect(state.update({ effects: mode.reconfigure(modeFacet.of('live')) }).state.selection.main.head).toBe(contentFrom);
  const composing = fixture().update({ effects: compositionEffect.of(true) }).state;
  expect(composing.update({ selection: { anchor: from + 1 } }).state.selection.main.head).toBe(from + 1);
});

it('repairs bypassed selections before paint and discards stale or disposed repairs', async () => {
  view = new EditorView({ state: fixture(), parent: document.body });
  view.dispatch({ selection: { anchor: from + 1 }, filter: false });
  await Promise.resolve();
  expect(view.state.selection.main.head).toBe(contentFrom);
  view.dispatch({ selection: { anchor: from + 1 }, filter: false });
  view.dispatch({ selection: { anchor: contentTo } });
  await Promise.resolve();
  expect(view.state.selection.main.head).toBe(contentTo);
  view.dispatch({ selection: { anchor: from + 1 }, filter: false });
  view.destroy(); view = undefined;
  await Promise.resolve();
});

it('deletes the character before a paired style at its edge and never leaves half a delimiter after body deletion', () => {
  const state = EditorState.create({ doc: 'x **body** y', extensions: [markdown(), modeFacet.of('live'),
    sourceRevealSetting.extension(() => 'hidden'), inlineBoundaryNavigation([{ nodes: ['StrongEmphasis'], marker: 'EmphasisMark', behavior: 'content' }])] });
  const start = state.update({ selection: { anchor: 4 } }).state;
  expect(start.update({ changes: { from: 2, to: 4 }, userEvent: 'delete.backward' }).state.doc.toString()).toBe('x**body** y');
  const end = state.update({ selection: EditorSelection.single(4, 8) }).state;
  expect(end.update({ ...end.replaceSelection(''), userEvent: 'delete.selection' }).state.doc.toString()).toBe('x  y');
});

it('honors a native opt-out', () => {
  const optOut = EditorState.create({ doc: source, extensions: [markdown(), modeFacet.of('live'), sourceRevealSetting.extension(() => 'hidden'),
    editingBoundaries([rule]), Prec.high(editingBoundaries([{ ...rule, resolve: context => ({ ...rule.resolve(context)!, navigation: 'native' }) }]))] });
  expect(optOut.update({ selection: { anchor: from + 1 } }).state.selection.main.head).toBe(from + 1);
});

it('lets a block clamp native line endpoints to its content without weakening shell deletion', () => {
  const state = EditorState.create({ doc: source, selection: { anchor: contentFrom + 1 }, extensions: [markdown(), modeFacet.of('live'),
    sourceRevealSetting.extension(() => 'hidden'), editingBoundaries([{ ...rule,
      resolve: context => ({ ...rule.resolve(context)!, navigation: 'content' }) }])] });
  for (const [position, expected] of [[from, contentFrom], [to, contentTo]] as const) {
    const cursor = state.update({ selection: { anchor: position }, userEvent: 'select' }).state.selection.main;
    expect(cursor.head).toBe(expected);
    expect(cursor.assoc).toBe(expected === contentFrom ? 1 : -1);
  }
  const start = state.update({ selection: { anchor: contentFrom } }).state;
  const backward = start.update({ changes: { from: contentFrom - 1, to: contentFrom }, userEvent: 'delete.backward' }).state;
  expect(backward.doc).toBe(state.doc);
  expect(backward.selection.main.head).toBe(from - 1);
});

it('keeps protected deletion document-neutral and preserves native annotations and mapped effects', () => {
  const state = fixture(), origin = Annotation.define<string>();
  const position = StateEffect.define<number>({ map: (value, changes) => changes.mapPos(value, 1) });
  const transaction = state.update({ changes: { from: contentFrom - 1, to: contentFrom }, userEvent: 'delete.backward',
    annotations: origin.of('native-input'), effects: position.of(contentFrom - 1), scrollIntoView: true });
  expect(transaction.docChanged).toBe(false);
  expect(transaction.state.doc).toBe(state.doc);
  expect(transaction.annotation(origin)).toBe('native-input');
  expect(transaction.effects.find(effect => effect.is(position))?.value).toBe(contentFrom);
  expect(transaction.scrollIntoView).toBe(true);
});

it('plans multiple caret deletions in one transaction without losing ranges', () => {
  const doc = 'L **one** `two` R';
  const state = EditorState.create({ doc, selection: EditorSelection.create([EditorSelection.cursor(4), EditorSelection.cursor(11)]),
    extensions: [EditorState.allowMultipleSelections.of(true), markdown(), modeFacet.of('live'), sourceRevealSetting.extension(() => 'hidden'),
      inlineBoundaryNavigation([{ nodes: ['StrongEmphasis'], marker: 'EmphasisMark', behavior: 'content' },
        { nodes: ['InlineCode'], marker: 'CodeMark', behavior: 'split' }])] });
  const edited = state.update({ changes: [{ from: 2, to: 4 }, { from: 10, to: 11 }], userEvent: 'delete.backward' }).state;
  expect(edited.doc.toString()).toBe('L**one**`two` R');
  expect(edited.selection.ranges.map(range => range.head)).toEqual([3, 9]);
});
