import type { MdExporter } from '../../export/types';
import type { QuireKitToolbarEntry } from "@quirekit/ui";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { getProseStructure } from "@quirekit/msfe-prose";
import { getMdCommentsBridge } from "../comments/bridge";
import type { MdEditorLocale } from "../types";
import { mdEditorMessages } from "../messages";
import { selectedAttributes } from "./context";
import { insertionHint } from "../blocks/insertion/availability";
import { canEditMdLink } from "../../commands/destination";
import { formattingHint } from "./availability";
import { mdShortcutKeys } from "../shortcuts/table";

/** @param id - Toolbar intent. @returns Its keyboard shortcut for the tooltip, when it has one. */
function keys(id: string): { readonly shortcut?: readonly string[] } {
  const shortcut = mdShortcutKeys(id);
  return shortcut ? { shortcut } : {};
}

/** @param editor - Accepted history owner. @param locale - Product language. @returns Bounded history actions without document or syntax queries. */
export function toolbarHistoryItems(editor: MsfeEditor, locale: MdEditorLocale): QuireKitToolbarEntry {
  const text = mdEditorMessages[locale], disabled = editor.state.readOnly;
  return { value: "history", label: text.history, kind: "group", children: [
    { value: "undo", ...keys("undo"), label: text.undo, icon: "undo", disabled: disabled || !editor.history.canUndo },
    { value: "redo", ...keys("redo"), label: text.redo, icon: "redo", disabled: disabled || !editor.history.canRedo },
  ] };
}

/**
 * Describe product actions using the same Toolbar contract as Classic Editor.
 * @param editor - Accepted source and command owner.
 * @param locale - Control language.
 * @param word - Whether the host enables explicit Word conversion.
 * @param templateName - Current style name, present only when a template library is installed; enables the style settings entry.
 * @param exporters - Host-installed export formats, listed after the built-in ones.
 * @returns Public groups, stateful toggles and menus; no independent control skin.
 */
export function toolbarItems(editor: MsfeEditor, locale: MdEditorLocale, word = true, templateName?: string, exporters: readonly Pick<MdExporter, 'id' | 'format'>[] = []): readonly QuireKitToolbarEntry[] {
  const text = mdEditorMessages[locale], disabled = editor.state.readOnly;
  const structure = getProseStructure(editor.state);
  const blockHint = insertionHint(editor.state, locale), blockDisabled = !!blockHint;
  const inlineHint = formattingHint(editor.state, locale), paragraphHint = formattingHint(editor.state, locale, true);
  const level = Number(selectedAttributes(editor, "heading")?.level ?? 0);
  /** @param name - Compiled extension identity. @returns Whether this product action is installed. */
  const installed = (name: string): boolean => Object.hasOwn(editor.storage, name);
  const styles = [text.paragraph, text.h1, text.h2, text.h3, text.h4, text.h5, text.h6];
  // Comments are text-neutral, so they stay available on a readonly source.
  const comments = getMdCommentsBridge(editor);
  const entries: QuireKitToolbarEntry[] = [
    toolbarHistoryItems(editor, locale),
    { value: "history-end", label: "", kind: "separator" },
    { value: "format", label: text.format, kind: "group", children: [
      { value: "bold", ...keys("bold"), label: text.bold, icon: "bold", kind: "toggle", pressed: !!selectedAttributes(editor, "bold"), disabled: disabled || !installed("bold") },
      { value: "emphasis", ...keys("emphasis"), label: text.emphasis, icon: "italic", kind: "toggle", pressed: !!selectedAttributes(editor, "emphasis"), disabled: disabled || !installed("emphasis") },
      { value: "strike", ...keys("strike"), label: text.strike, icon: "strike", kind: "toggle", pressed: !!selectedAttributes(editor, "strikethrough"), disabled: disabled || !installed("strikethrough") },
      { value: "insertedText", ...keys("insertedText"), label: text.insertedText, icon: "underline", kind: "toggle", pressed: !!selectedAttributes(editor, "insertedText"), disabled: disabled || !installed("insertedText") },
      { value: "inlineCode", ...keys("inlineCode"), label: text.inlineCode, icon: "code", kind: "toggle", pressed: !!selectedAttributes(editor, "inlineCode"), disabled: disabled || !installed("inlineCode") },
      { value: "highlight", ...keys("highlight"), label: text.highlight, icon: "textHighlight", kind: "toggle", pressed: !!selectedAttributes(editor, "highlight"), disabled: disabled || !installed("highlight") },
      { value: "superscript", ...keys("superscript"), label: text.superscript, icon: "superscript", kind: "toggle", pressed: !!selectedAttributes(editor, "superscript"), disabled: disabled || !installed("superscript") },
      { value: "subscript", ...keys("subscript"), label: text.subscript, icon: "subscript", kind: "toggle", pressed: !!selectedAttributes(editor, "subscript"), disabled: disabled || !installed("subscript") },
    ] },
    { value: "format-end", label: "", kind: "separator" },
    { value: "heading", label: text.heading, kind: "custom", renderer: "style", text: styles[level] ?? text.paragraph,
      payload: `heading-${level}`, disabled: disabled || !installed("heading"),
      items: styles.map((label, index) => ({ value: `heading-${index}`, label, ...keys(`heading-${index}`) })) },
    { value: "blocks", label: text.blocks, kind: "group", children: [
      { value: "task", ...keys("task"), label: text.task, icon: "listTodo", disabled: disabled || !installed("taskItem") },
      { value: "list", ...keys("list"), label: text.list, icon: "listBullet", disabled: disabled || !installed("listMarkers") },
      { value: "ordered", ...keys("ordered"), label: text.ordered, icon: "listNumbered", disabled: disabled || !installed("listMarkers") },
      { value: "outdent", ...keys("outdent"), label: text.outdent, icon: "indentDecrease", disabled: disabled || !structure.list || !installed("listMarkers") },
      { value: "indent", ...keys("indent"), label: text.indent, icon: "indentIncrease", disabled: disabled || !structure.indentList || !installed("listMarkers") },
    ] },
    { value: "blocks-end", label: "", kind: "separator" },
    { value: "insert-code", label: text.code, icon: "code", disabled: blockDisabled || !installed("code-block"), ...(blockHint ? { disabledReason: blockHint } : {}) },
    { value: "insert-table", label: text.table, icon: "table", disabled: blockDisabled || !installed("table"), ...(blockHint ? { disabledReason: blockHint } : {}) },
    { value: "link", ...keys("link"), label: text.link, icon: "link", disabled: disabled || !installed("link") || !canEditMdLink(editor.state), disabledReason: text.linkUnavailable },
    { value: "image", label: text.image, icon: "image", disabled: disabled || !installed("image") },
    { value: "insert", label: text.insert, text: text.insert, icon: "insert", kind: "custom", renderer: "insertion", disabled },
    { value: "comment", ...keys("comment"), label: text.addComment, icon: "messageSquarePlus", hidden: !comments, disabled: !comments?.writable() },
    { value: "comments", label: text.comments, icon: "messageSquare", kind: "menu", trigger: "disclosure", hidden: !comments, overlayProps: { restoreFocus: false }, items: [
      { value: "comment-previous", label: text.previousComment, icon: "commentPrevious" }, { value: "comment-next", label: text.nextComment, icon: "commentNext" },
      { value: "comment-document", label: text.addDocumentComment, icon: "messageSquarePlus", disabled: !comments?.writable() },
      { value: "comments-panel", label: text.allComments, icon: "messageSquare" },
    ] },
    { value: "table-actions", label: text.table, kind: "group", hidden: !structure.table || !installed("table"), children: [
      { value: "row", label: text.row, icon: "tableInsertRowBelow", disabled },
      { value: "column", label: text.column, icon: "tableInsertColumnRight", disabled },
      { value: "table-structure", label: text.tableActions, icon: "tableProperties", kind: "menu", trigger: "disclosure", overlayProps: { restoreFocus: false }, disabled, items: [
        { value: "row-before", icon: "tableInsertRowAbove", label: text.rowBefore }, { value: "row-after", icon: "tableInsertRowBelow", label: text.rowAfter },
        { value: "column-before", icon: "tableInsertColumnLeft", label: text.columnBefore }, { value: "column-after", icon: "tableInsertColumnRight", label: text.columnAfter },
        { value: "delete-row", icon: "tableDeleteRow", label: text.deleteRow, disabled: !structure.deleteRow }, { value: "delete-column", icon: "tableDeleteColumn", label: text.deleteColumn, disabled: !structure.deleteColumn },
        { value: "align-left", icon: "alignStart", label: text.alignLeft }, { value: "align-center", icon: "alignCenter", label: text.alignCenter },
        { value: "align-right", icon: "alignEnd", label: text.alignRight }, { value: "align-default", icon: "tableProperties", label: text.alignDefault },
      ] },
    ] },
    { value: "shortcuts", label: text.shortcuts, icon: "keyboard", ...keys("shortcuts") },
    { value: "files", label: text.importExport, icon: "arrowUpDown", kind: "custom", renderer: "files", indicator: false,
      overlayProps: { restoreFocus: false, width: "264px", maxWidth: "calc(100vw - 32px)" }, items: [
      ...((word || exporters.length) && templateName !== undefined ? [{ value: 'exportTemplate', icon: 'slidersHorizontal', label: text.exportStyleSettings }, { value: 'template-divider', label: '', kind: 'separator' as const }] : []),
      { value: "imports", label: text.importGroup, kind: "group", children: [
        { value: "markdown", label: text.markdown, disabled },
        ...(word ? [{ value: "wordImport", label: text.wordImport, disabled }] : []),
      ] },
      { value: "files-divider", label: "", kind: "separator" },
      { value: "exports", label: text.exportGroup, kind: "group", children: [
        { value: "export", label: text.export },
        ...(comments?.exportsReview() ? [{ value: "exportReview", label: text.exportWithComments }] : []),
        ...(word ? [{ value: "wordExport", label: text.wordExport }] : []),
        ...exporters.map(exporter => ({ value: `export:${exporter.id}`, label: text.formatExport.replace('{format}', exporter.format) })),
      ] },
    ] },
  ];
  return entries.map(entry => {
    if (entry.value === "format") return { ...entry, children: entry.children!.map(item => {
      const canRemoveCode = item.value === "inlineCode" && item.pressed;
      return inlineHint && !canRemoveCode ? { ...item, disabled: true, disabledReason: inlineHint } : item;
    }) };
    if (entry.value === "heading" && paragraphHint) return { ...entry, disabled: true, disabledReason: paragraphHint };
    if (entry.value === "blocks" && paragraphHint) return { ...entry, children: entry.children!.map(item => ({ ...item,
      disabled: true, disabledReason: paragraphHint })) };
    return entry;
  });
}
