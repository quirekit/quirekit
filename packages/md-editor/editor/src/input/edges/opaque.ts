import { Prec } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { typeBesideOpaqueBlock } from "./blocks";

/**
 * Typing and input-method composition beside dividers and rendered previews
 * write into a new paragraph next to them. The paragraph opens on keydown, which
 * precedes composition, so the preedit starts in it rather than being moved.
 */
export const opaqueBlockInput = Prec.highest([
  EditorView.domEventHandlers({ keydown(event, view) {
    const typing = event.key.length === 1 || event.key === "Process" || event.keyCode === 229;
    if (!typing || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
    const spec = typeBesideOpaqueBlock(view, "");
    if (spec) view.dispatch(spec);
    return false;
  },
  // Fallback for a composition that starts without a preceding keydown.
  compositionstart(_event, view) {
    const spec = typeBesideOpaqueBlock(view, "");
    if (spec) view.dispatch(spec);
    return false;
  } }),
  EditorView.inputHandler.of((view, from, to, text) => {
    if (from !== to || view.composing) return false;
    const spec = typeBesideOpaqueBlock(view, text);
    if (spec) view.dispatch(spec);
    return !!spec;
  }),
]);
