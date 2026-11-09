// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { EditorView, runScopeHandlers } from "@quirekit/cm-view";
import { mdShortcutKeymap } from "./keymap";
import { mdShortcutGroups } from "./table";

const shifted: Readonly<Record<string, string>> = { 7: "&", 8: "*", 9: "(" };
const codes: Readonly<Record<string, number>> = { ".": 190, ",": 188, "/": 191, Enter: 13, Tab: 9, ArrowUp: 38, ArrowDown: 40 };

/** @param name - CodeMirror key name on a non-macOS host. @returns The keydown a user produces for it. */
function keydown(name: string): KeyboardEvent {
  const parts = name.split(/-(?!$)/u), base = parts.pop()!, shift = parts.includes("Shift");
  return new KeyboardEvent("keydown", { key: shift && shifted[base] ? shifted[base] : base, keyCode: codes[base] ?? base.toUpperCase().charCodeAt(0),
    ctrlKey: parts.includes("Mod") || parts.includes("Ctrl"), altKey: parts.includes("Alt"), shiftKey: shift, cancelable: true });
}

it("binds every intent row of the shortcut table to its toolbar intent", () => {
  const ran: string[] = [];
  const view = new EditorView({ state: EditorState.create({ extensions: mdShortcutKeymap(id => { ran.push(id); return true; }) }), parent: document.body });
  try {
    const rows = mdShortcutGroups("zh-CN", { comments: true, blockMenu: true }).flatMap(group => group.items).filter(item => item.intent);
    for (const row of rows) {
      expect(runScopeHandlers(view, keydown(row.key), "editor"), row.key).toBe(true);
      expect(ran.at(-1), row.key).toBe(row.id);
    }
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
  } finally { view.destroy(); }
});
