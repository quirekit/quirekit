import { createSearchPanel } from "../search/panel";
import { navigationEffect } from "../search/navigation/effect";
import { defaultEditorIcon } from "../presentation/icons";
import type { MsfeIconFactory } from "../presentation/types";
import { EditorState, Prec, type Extension } from "@quirekit/cm-state";
import { EditorView, drawSelection, dropCursor, highlightSpecialChars, keymap, rectangularSelection } from "@quirekit/cm-view";
import { defaultKeymap } from "@quirekit/cm-commands";
import { bracketMatching, codeFolding, defaultHighlightStyle, foldKeymap, syntaxHighlighting } from "@quirekit/cm-language";
import { closeBrackets, closeBracketsKeymap } from "@quirekit/cm-autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@quirekit/cm-search";
import type { MarkdownExtension } from "@quirekit/lezer-markdown";
import { compositionField, revisionField } from "../state/fields";
import { markdownParser } from "../source/parsing/parser";
import { createMarkdownLanguage } from "../markdown/parsing/language";
import type { LanguageDescription } from "@quirekit/cm-language";
import type { Panel } from "@quirekit/cm-view";

/**
 * Keeps Tab inside an editable document once no feature claims it; Escape then Tab still moves focus.
 * @param view - Focused editor.
 * @returns Whether the key was consumed.
 */
function holdTab(view: EditorView): boolean {
  return view.state.facet(EditorView.editable) && !view.state.readOnly;
}

/**
 * Creates a document state only on initial mount or explicit document replacement.
 * @param text - Accepted logical Markdown source.
 * @param extensions - Instance projection, lifecycle and presentation configuration.
 * @param revision - Monotonic base revision, preventing document replacement from reviving old targets.
 * @param syntax - Extension grammar contributions for the single parser.
 * @param icon - Shared SVG renderer for native controls.
 * @param codeLanguages - Exact lazy language lookup.
 * @param searchPanel - Mounted host search renderer.
 * @returns State with a single persistent history and parser.
 */
export function createDocumentState(text: string, extensions: Extension, revision = 0, syntax: readonly MarkdownExtension[] = [], icon: MsfeIconFactory = defaultEditorIcon,
  codeLanguages?: (name: string) => LanguageDescription | null, searchPanel?: (view: EditorView) => Panel): EditorState {
  return EditorState.create({ doc: text, extensions: [
    revisionField.init(() => revision), compositionField, markdownParser, EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping, drawSelection(), dropCursor(), rectangularSelection(),
    highlightSpecialChars(), bracketMatching(), closeBrackets(),
    codeFolding({ placeholderDOM(view, onclick) {
      const button = view.dom.ownerDocument.createElement("button"); button.type = "button";
      button.className = "cm-foldPlaceholder"; button.setAttribute("aria-label", view.state.phrase("unfold"));
      button.append(icon("ellipsis", view.dom.ownerDocument)); button.addEventListener("click", onclick); return button;
    } }), search({ top: true, createPanel: searchPanel ?? (view => createSearchPanel(view, { icons: icon })),
      scrollToMatch: range => navigationEffect.of({ range, y: "nearest", search: true }),
    }), highlightSelectionMatches(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    createMarkdownLanguage(syntax, codeLanguages),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...foldKeymap]),
    Prec.lowest(keymap.of([{ key: "Tab", run: holdTab, shift: holdTab }])),
    // Observers run even when a feature consumes Escape, so Escape then Tab always leaves the editor.
    EditorView.domEventObservers({ keydown(event, view) { if (event.key === "Escape") view.setTabFocusMode(2000); } }),
    extensions,
  ] });
}
