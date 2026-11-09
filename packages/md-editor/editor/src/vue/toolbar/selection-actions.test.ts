import { EditorSelection, EditorState } from "@quirekit/cm-state";
import type { QuireKitToolbarEntry } from "@quirekit/ui";
import { describe, expect, it, vi } from "vitest";
import { readMdSelection, sameToolbarItems, selectionActionOf, withSelectionActions } from "./presentation";

const bold: QuireKitToolbarEntry = { value: "bold", label: "Bold" };
const send = { id: "send", label: "Send", icon: "send", run: vi.fn() };

describe("selection actions", () => {
  it("appends host commands after a separator and leaves the toolbar alone without any", () => {
    expect(withSelectionActions([bold]).map(entry => entry.value)).toEqual(["bold"]);
    const entries = withSelectionActions([bold], [send]);
    expect(entries.map(entry => entry.kind ?? "button")).toEqual(["button", "separator", "button"]);
    expect(entries[2]).toEqual({ value: "selection-action:send", label: "Send", icon: "send" });
  });

  it("keeps host commands when a readonly source has no formatting entries", () => {
    expect(withSelectionActions([], [send]).map(entry => entry.label)).toEqual(["Send"]);
  });

  it("resolves only intents it created", () => {
    expect(selectionActionOf("selection-action:send", [send])).toBe(send);
    expect(selectionActionOf("bold", [send])).toBeUndefined();
    expect(selectionActionOf("selection-action:other", [send])).toBeUndefined();
  });

  it("reports the Markdown source and one-based lines", () => {
    const state = EditorState.create({ doc: "# a\n\n**bold**\nend", selection: EditorSelection.range(5, 14) });
    expect(readMdSelection(state)).toEqual({ text: "**bold**\ne".slice(0, 9), from: 5, to: 14, startLine: 3, endLine: 4 });
  });
});

describe("toolbar rebuilds", () => {
  const group = (pressed: boolean): QuireKitToolbarEntry => ({ value: "format", label: "Format", kind: "group", children: [{ value: "bold", label: "Bold", kind: "toggle", pressed }] });

  it("treats an identical rebuilt list as unchanged", () => {
    expect(sameToolbarItems([group(false)], [group(false)])).toBe(true);
  });

  it("sees a changed control at any depth, an added control and a new callback", () => {
    expect(sameToolbarItems([group(false)], [group(true)])).toBe(false);
    expect(sameToolbarItems([group(false)], [group(false), bold])).toBe(false);
    expect(sameToolbarItems([{ ...bold, run: () => 1 }], [{ ...bold, run: () => 1 }])).toBe(false);
  });
});
