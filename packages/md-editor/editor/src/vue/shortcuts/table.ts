import { mdEditorMessages } from "../messages";
import type { MdEditorLocale } from "../types";
import type { MdShortcut, MdShortcutGroup } from "./types";
import { displayKeys, macKeys } from "./keys";

/**
 * @param locale - Label language.
 * @param installed - Optional workspaces whose keys apply: comments and the block handle menu.
 * @returns Every documented binding, grouped for the reference dialog; intent rows are bound by the product keymap.
 */
export function mdShortcutGroups(locale: MdEditorLocale, installed: { readonly comments?: boolean; readonly blockMenu?: boolean } = {}): readonly MdShortcutGroup[] {
  const text = mdEditorMessages[locale];
  /** @returns A row whose key runs the toolbar intent of the same name. */
  const run = (id: string, key: string, label: string, mac?: string): MdShortcut => ({ id, key, label, intent: true, ...(mac ? { mac } : {}) });
  /** @returns A row whose key an installed editor extension already owns. */
  const owned = (id: string, key: string, label: string, mac?: string): MdShortcut => ({ id, key, label, intent: false, ...(mac ? { mac } : {}) });
  const headings = [text.paragraph, text.h1, text.h2, text.h3, text.h4, text.h5, text.h6];
  return [
    // macOS keeps Cmd-Shift-H for replace, so highlight uses Ctrl-Shift-H there.
    { title: text.format, items: [
      run("bold", "Mod-b", text.bold), run("emphasis", "Mod-i", text.emphasis), run("insertedText", "Mod-u", text.insertedText),
      run("strike", "Mod-Shift-s", text.strike), run("inlineCode", "Mod-e", text.inlineCode), run("highlight", "Mod-Shift-h", text.highlight, "Ctrl-Shift-h"),
      run("superscript", "Mod-.", text.superscript), run("subscript", "Mod-,", text.subscript), run("link", "Mod-k", text.link),
    ] },
    { title: text.blocks, items: [
      ...headings.map((label, level) => run(`heading-${level}`, `Mod-Alt-${level}`, label)),
      run("list", "Mod-Shift-8", text.list), run("ordered", "Mod-Shift-7", text.ordered), run("task", "Mod-Shift-9", text.task),
      owned("codeBlock", "Mod-Alt-c", text.code), owned("indent", "Tab", text.indent), owned("outdent", "Shift-Tab", text.outdent),
    ] },
    { title: text.editing, items: [
      owned("undo", "Mod-z", text.undo), owned("redo", "Mod-y", text.redo, "Mod-Shift-z"),
      owned("find", "Mod-f", text.searchFind), owned("replace", "Ctrl-h", text.searchReplace, "Mod-Shift-h"),
      owned("lineBreak", "Shift-Enter", text.lineBreak), owned("exitBlock", "Mod-Enter", text.exitBlock),
      ...(installed.comments ? [owned("comment", "Mod-Alt-m", text.addComment)] : []),
      ...(installed.blockMenu ? [owned("blockMenu", "Mod-Alt-b", text.blockMenu)] : []),
      owned("previousHeading", "Mod-Alt-ArrowUp", text.previousHeading), owned("nextHeading", "Mod-Alt-ArrowDown", text.nextHeading),
      owned("switchView", "Mod-Alt-v", text.switchView), run("shortcuts", "Mod-/", text.shortcuts),
    ] },
  ];
}

// Toolbar entries are rebuilt on every accepted state, so the key lookup is built once per platform.
const lookups = new Map<boolean, ReadonlyMap<string, readonly string[]>>();

/**
 * @param id - Toolbar intent or documented action.
 * @param mac - Platform convention.
 * @returns Display keys for a toolbar tooltip, or undefined when the action has no shortcut.
 */
export function mdShortcutKeys(id: string, mac = macKeys): readonly string[] | undefined {
  let lookup = lookups.get(mac);
  if (!lookup) {
    const items = mdShortcutGroups("zh-CN", { comments: true, blockMenu: true }).flatMap(group => group.items);
    lookup = new Map(items.map(item => [item.id, displayKeys(mac ? item.mac ?? item.key : item.key, mac)]));
    lookups.set(mac, lookup);
  }
  return lookup.get(id);
}
