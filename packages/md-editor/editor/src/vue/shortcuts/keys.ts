/** Whether the host follows macOS key conventions, matching CodeMirror's `Mod` resolution. */
export const macKeys = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/u.test(navigator.platform);

const macModifiers: Readonly<Record<string, string>> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Mod: "⌘", Meta: "⌘" };
const otherModifiers: Readonly<Record<string, string>> = { Ctrl: "Ctrl", Alt: "Alt", Shift: "Shift", Mod: "Ctrl", Meta: "Win" };
// Apple orders modifiers Control, Option, Shift, Command; other platforms read Ctrl, Alt, Shift.
const macOrder = ["Ctrl", "Alt", "Shift", "Mod", "Meta"], otherOrder = ["Mod", "Ctrl", "Alt", "Shift", "Meta"];
const names: Readonly<Record<string, readonly [mac: string, other: string]>> = {
  ArrowUp: ["↑", "↑"], ArrowDown: ["↓", "↓"], ArrowLeft: ["←", "←"], ArrowRight: ["→", "→"], Enter: ["↵", "Enter"], Tab: ["⇥", "Tab"],
};

/**
 * @param key - CodeMirror key name such as `Mod-Shift-8`.
 * @param mac - Platform convention; defaults to the current host.
 * @returns Keys in reading order for display, such as `["⇧", "⌘", "8"]` or `["Ctrl", "Shift", "8"]`.
 */
export function displayKeys(key: string, mac = macKeys): string[] {
  const parts = key.split(/-(?!$)/u), base = parts.pop()!;
  const order = mac ? macOrder : otherOrder, symbols = mac ? macModifiers : otherModifiers;
  const modifiers = parts.sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(part => symbols[part] ?? part);
  const name = names[base]?.[mac ? 0 : 1] ?? (base.length === 1 ? base.toUpperCase() : base);
  return [...modifiers, name];
}
