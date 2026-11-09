import { describe, expect, it } from "vitest";
import { displayKeys } from "./keys";
import { mdShortcutKeys } from "./table";

describe("shortcut display", () => {
  it("orders modifiers by platform convention", () => {
    expect(displayKeys("Mod-Shift-8", true)).toEqual(["⇧", "⌘", "8"]);
    expect(displayKeys("Mod-Alt-c", true)).toEqual(["⌥", "⌘", "C"]);
    expect(displayKeys("Mod-Shift-8", false)).toEqual(["Ctrl", "Shift", "8"]);
    expect(displayKeys("Mod-Alt-ArrowDown", false)).toEqual(["Ctrl", "Alt", "↓"]);
    expect(displayKeys("Mod-,", true)).toEqual(["⌘", ","]);
    expect(displayKeys("Shift-Enter", false)).toEqual(["Shift", "Enter"]);
  });

  it("resolves platform-specific bindings for toolbar tooltips", () => {
    expect(mdShortcutKeys("highlight", true)).toEqual(["⌃", "⇧", "H"]);
    expect(mdShortcutKeys("highlight", false)).toEqual(["Ctrl", "Shift", "H"]);
    expect(mdShortcutKeys("redo", true)).toEqual(["⇧", "⌘", "Z"]);
    expect(mdShortcutKeys("export", false)).toBeUndefined();
  });
});
