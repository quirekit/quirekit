// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import type { EditorView, ViewUpdate } from "@quirekit/cm-view";
import type { MsfeEditor } from "../../editor/types";
import { compositionField, modeFacet } from "../../state/fields";
import { SourceBlockInteraction } from "./runtime";

/** @returns An interaction on a live source, with the host observer and one accepted text update. */
function setup() {
  const state = EditorState.create({ doc: "first\n\nsecond", extensions: [compositionField, modeFacet.of("live")] });
  const view = { dom: document.createElement("div"), state, hasFocus: false, requestMeasure: vi.fn(), root: document } as unknown as EditorView;
  const change = vi.fn();
  const interaction = new SourceBlockInteraction(view, () => ({}) as MsfeEditor, { change, openMenu: vi.fn() });
  const typed = { view, state, startState: state, docChanged: true, selectionSet: true, focusChanged: false, geometryChanged: false, viewportChanged: false, transactions: [] } as unknown as ViewUpdate;
  return { interaction, view, change, typed };
}

describe("block controls during text input", () => {
  it("stay mounted and re-measure instead of being retired on every keystroke", () => {
    const { interaction, view, change, typed } = setup();
    interaction.update(typed);
    expect(change).not.toHaveBeenCalled();
    expect(view.requestMeasure).toHaveBeenCalledTimes(1);
    interaction.destroy();
  });

  it("are retired when an edit invalidates an open menu", () => {
    const { interaction, change, typed } = setup();
    (interaction as unknown as { pinned: boolean }).pinned = true;
    interaction.update(typed);
    expect(change).toHaveBeenCalledWith(null);
    interaction.destroy();
  });
});
