import { shallowRef, watch, type Ref } from "vue";
import type { QuireKitToolbarEntry } from "@quirekit/ui";
import type { EditorState } from "@quirekit/cm-state";
import type { MsfeEditor } from "@quirekit/msfe-core";
import type { MdSelectionAction, MdSelectionContext } from "../types";

/**
 * Observe the toolbar's breakpoint once per mounted source owner.
 * @param editor - Reactive native editor owner, including iframe documents.
 * @param narrow - Optional shared breakpoint state, created before native initialization.
 * @returns Whether the compact toolbar should be presented.
 */
export function useNarrowToolbar(editor: () => MsfeEditor | null | undefined, narrow = shallowRef(false)): Ref<boolean> {
  watch(editor, (owner, _previous, cleanup) => {
    const query = owner?.element.ownerDocument.defaultView?.matchMedia("(max-width: 767px)");
    /** Apply only breakpoint changes; input transactions never reread width. */
    function update(): void { narrow.value = !!query?.matches; }
    update();
    query?.addEventListener("change", update);
    cleanup(() => query?.removeEventListener("change", update));
  }, { immediate: true });
  return narrow;
}

/**
 * Toolbar entries are plain data, so a rebuilt list that describes the same controls need not re-render them.
 * @param left - Previous value.
 * @param right - Rebuilt value.
 * @returns Whether both describe identical controls; functions compare by identity.
 */
export function sameToolbarItems(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every(key => sameToolbarItems((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}

/**
 * Keep primary tasks ahead of the public Toolbar's trailing-group collapse.
 * @param entries - Original controls and execution identities.
 * @returns The same entries, with history, style and insertion first.
 */
export function compactToolbarItems(entries: readonly QuireKitToolbarEntry[]): readonly QuireKitToolbarEntry[] {
  const primary = ["history", "heading", "insert"];
  return [...primary.flatMap(value => entries.filter(entry => entry.value === value)),
    ...entries.filter(entry => !primary.includes(entry.value))];
}

/** Selection toolbar contents: text style, inline formats, link and comment, in product order. */
const selectionEntries = ["heading", "format", "link", "comment"];
/** Inline formats kept in the selection toolbar; the rest stay in the fixed toolbar and slash menu. */
const selectionFormats = ["bold", "emphasis", "strike", "insertedText", "inlineCode", "highlight"];

/**
 * Reduce the full product toolbar to the floating selection toolbar.
 * @param entries - Original controls and execution identities.
 * @param readOnly - Source cannot change; only text-neutral actions such as comments remain.
 * @returns Style field, primary inline formats, link and comment, separated as groups.
 */
export function selectionToolbarItems(entries: readonly QuireKitToolbarEntry[], readOnly = false): readonly QuireKitToolbarEntry[] {
  const picked = (readOnly ? ["comment"] : selectionEntries).flatMap(value => entries.filter(entry => entry.value === value && !entry.hidden)).map(entry => entry.value === "format" && entry.children
    ? { ...entry, children: entry.children.filter(child => selectionFormats.includes(child.value)) } : entry);
  return picked.flatMap((entry, index) => index ? [{ value: `${entry.value}-start`, label: "", kind: "separator" as const }, entry] : [entry]);
}

const selectionActionPrefix = "selection-action:";

/**
 * @param entries - Selection toolbar entries.
 * @param actions - Host commands, in display order.
 * @returns Entries followed by the host commands.
 */
export function withSelectionActions(entries: readonly QuireKitToolbarEntry[], actions: readonly MdSelectionAction[] = []): readonly QuireKitToolbarEntry[] {
  if (!actions.length) return entries;
  const commands = actions.map(action => ({ value: `${selectionActionPrefix}${action.id}`, label: action.label, ...(action.icon ? { icon: action.icon } : {}) }));
  return entries.length ? [...entries, { value: `${selectionActionPrefix}start`, label: "", kind: "separator" as const }, ...commands] : commands;
}

/**
 * @param value - Toolbar intent.
 * @param actions - Host commands.
 * @returns The host command named by the intent, if any.
 */
export function selectionActionOf(value: string, actions: readonly MdSelectionAction[] = []): MdSelectionAction | undefined {
  return value.startsWith(selectionActionPrefix) ? actions.find(action => `${selectionActionPrefix}${action.id}` === value) : undefined;
}

/**
 * @param state - Accepted editor state.
 * @returns Main selection as Markdown source and one-based source lines.
 */
export function readMdSelection(state: EditorState): MdSelectionContext {
  const { from, to } = state.selection.main;
  return { text: state.sliceDoc(from, to), from, to, startLine: state.doc.lineAt(from).number, endLine: state.doc.lineAt(to).number };
}
