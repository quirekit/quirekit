import { Prec, type Extension } from "@quirekit/cm-state";
import { keymap } from "@quirekit/cm-view";
import { mdShortcutGroups } from "./table";

/**
 * Binds the documented toolbar shortcuts to the same intents as their buttons.
 * Ranks above editor defaults such as CodeMirror's `Mod-i` and `Mod-/`.
 * @param run - Runs one intent; returns whether the key was consumed.
 * @returns Keymap for every intent row of the shortcut table.
 */
export function mdShortcutKeymap(run: (id: string) => boolean): Extension {
  const bindings = mdShortcutGroups("zh-CN", { comments: true, blockMenu: true }).flatMap(group => group.items).filter(item => item.intent);
  return Prec.high(keymap.of(bindings.map(item => ({ key: item.key, ...(item.mac ? { mac: item.mac } : {}), preventDefault: true,
    run: view => !view.composing && run(item.id) }))));
}
