import { highlightSelectionMatches } from "@quirekit/cm-search";
import type { MsfeEditorOptions } from "../editor/types";
import { defaultEditorIcon } from "./icons";
import { EditorState, type Extension } from "@quirekit/cm-state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@quirekit/cm-view";
import { foldGutter } from "@quirekit/cm-language";
import { oneDark } from "@quirekit/cm-theme-one-dark";
import { modeFacet } from "../state/fields";
import type { MsfeMode } from "../state/types";

// Keep the selection layer for reading/copying, while suppressing insertion affordances.
// The native DOM permission alone does not hide drawSelection's independent cursor layer.
const readonlyPresentation = EditorView.theme({
  "& .cm-cursorLayer, & .cm-dropCursor": { display: "none" },
  "& .cm-content[aria-readonly=true]": { caretColor: "transparent" },
});

/**
 * Resolves a mode without replacing document or history fields.
 * @param mode - Requested presentation mode.
 * @param readOnly - Explicit host editing permission.
 * @param options - Host icon seam and owner document.
 * @returns Presentation-only configuration.
 */
export function modeConfiguration(mode: MsfeMode, readOnly: boolean, options: MsfeEditorOptions): Extension {
  const locked = readOnly || mode === "locked";
  return [
    modeFacet.of(mode), EditorState.readOnly.of(locked), EditorView.editable.of(!locked),
    // A non-editable content DOM still needs focus for keyboard selection and copy.
    EditorView.contentAttributes.of({ "aria-readonly": String(locked), tabindex: "0" }),
    locked ? readonlyPresentation : [],
    EditorView.editorAttributes.of({ "data-msfe-mode": mode }),
    mode === "source" ? [lineNumbers(), foldGutter({ markerDOM: open => (options.icons ?? defaultEditorIcon)(open ? "chevronDown" : "chevronRight", options.parent.ownerDocument) }), highlightActiveLine(), highlightActiveLineGutter(), highlightSelectionMatches()] : [],
  ];
}

/**
 * Applies a restrained editor surface without owning the host page layout.
 * @param theme - Host-selected light or dark palette.
 * @returns CodeMirror theme configuration.
 */
export function themeConfiguration(theme: "light" | "dark"): Extension {
  return [theme === "dark" ? oneDark : [], EditorView.theme({
    "&": { height: "100%", fontSize: "15px", backgroundColor: theme === "dark" ? "#20242c" : "#fff" },
    ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" },
    ".cm-content": { padding: "20px 0", minHeight: "160px", minWidth: "0" },
    ".cm-line": { padding: "0 24px", lineHeight: "1.8" },
    "&[data-msfe-mode=live] .cm-content, &[data-msfe-mode=locked] .cm-content": {
      fontFamily: "system-ui, sans-serif", maxWidth: "850px", margin: "0 auto",
    },
    "&.cm-focused": { outline: "2px solid #708e9b", outlineOffset: "-2px" },
  })];
}
