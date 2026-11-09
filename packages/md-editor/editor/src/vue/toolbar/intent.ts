import { openMsfeDataView } from "@quirekit/msfe-data-view";
import { openMdDataView } from "../data-view/open";
import { canInsertSourceBlock, type MsfeEditor, type MsfeTarget } from "@quirekit/msfe-core";
import { openMsfeFlowchart } from "@quirekit/msfe-flowchart";
import { openMsfeMindMap } from "@quirekit/msfe-mind-map";
import { openMsfeWhiteboard } from "@quirekit/msfe-whiteboard";
import { openMdFlowchartDialog } from "../flowchart/open";
import { openMdMindMapDialog } from "../mind-map/open";
import { openMdWhiteboardDialog } from "../whiteboard/open";
import type { MdEditorLocale } from "../types";
import type { MdDialogKind } from "../dialogs/types";
import type { MdChromeIntents } from "../mobile/types";
import { runToolbarAction } from "./actions";
import { isBlockInsertionIntent } from "./insertion";
import { formattingRejected } from "./availability";
/** @param editor - Canonical command owner. @param value - Installed chrome action. @param locale - Content language. @param target - Fresh original intent. @param intents - Product workspaces, shared by every entry. */
export function dispatchChromeIntent(editor: MsfeEditor, value: string, locale: MdEditorLocale, target: MsfeTarget | undefined, intents: MdChromeIntents): void {
  if (isBlockInsertionIntent(value)) {
    // Explicit activation also validates document/instance identity, composition
    // and permission before opening a deferred workspace at the captured range.
    if (!editor.can(state => canInsertSourceBlock(state) ? {} : null, target)) return;
  }
  if (value === "dataView") openMsfeDataView(editor, openMdDataView, target?.selection.main ?? editor.state.selection.main);
  else if (value === "flowchart") openMsfeFlowchart(editor, openMdFlowchartDialog, target?.selection.main ?? editor.state.selection.main);
  else if (value === "mindMap") openMsfeMindMap(editor, openMdMindMapDialog, target?.selection.main ?? editor.state.selection.main);
  else if (value === "whiteboard") openMsfeWhiteboard(editor, openMdWhiteboardDialog, target?.selection.main ?? editor.state.selection.main);
  else if (value === "exportTemplate") intents.template();
  else if (value === "comment") intents.comment?.();
  else if (value === "shortcuts") intents.shortcuts?.();
  else if (value === "comments-panel") intents.comments?.();
  else if (value === "comment-document") intents.documentComment?.();
  else if (value === "comment-previous" || value === "comment-next") intents.commentStep?.(value === "comment-next" ? 1 : -1);
  else if (value.startsWith("export:")) intents.file("formatExport", value.slice(7));
  else if (["markdown", "wordImport", "wordExport"].includes(value)) intents.file(value === "markdown" ? "markdownImport" : value as "wordImport");
  else if (["link", "image", "inlineMath", "displayMath", "mermaid", "textDiagram"].includes(value)) intents.edit(value as MdDialogKind, target);
  else { if (runToolbarAction(editor, value, locale, target) === false) intents.feedback?.(formattingRejected(locale)); editor.focus(); }
}
