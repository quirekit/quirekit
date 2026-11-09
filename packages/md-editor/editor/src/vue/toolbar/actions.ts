import { linkifyTextLinks } from "@quirekit/msfe-link";
import { toggleSourceMark, withSourceOperation, type MsfeEditor, type MsfeTarget } from "@quirekit/msfe-core";
import type { TableAlignment } from "@quirekit/msfe-prose";
import { insertMarkdownBlock } from "../../commands/insert";
import { insertMdFootnote } from "../../commands/footnote";
import { toggleMdInlineCode } from "../../commands/inline";
import { toggleMdList } from "../../commands/list";
import { insertionBlocks } from "./blocks";
import { getMdCommentsBridge } from "../comments/bridge";
import type { MdEditorLocale } from "../types";
import { mdExportFileName } from "../files/name";

/** @param editor - Guarded source owner. @param value - Public toolbar intent. @param locale - New content language. @param target - Captured menu selection. @returns Format acceptance when applicable; other actions retain their own feedback. */
export function runToolbarAction(editor: MsfeEditor, value: string, locale: MdEditorLocale, target?: MsfeTarget): boolean | undefined {
  const chain = editor.chain(target);
  if (value.startsWith("heading-")) chain.setHeading(Number(value.slice(8))).run();
  else if (value.startsWith("insert-")) {
    const block = insertionBlocks(locale).find(item => item.id === value.slice(7));
    if (block) editor.run(withSourceOperation(insertMarkdownBlock(block.source), { kind: "block.insert", facts: { type: block.id } }), target);
  } else if (value.startsWith("align-")) chain.setTableColumnAlignment(value.slice(6) as TableAlignment).run();
  else if (value === "undo") editor.undo();
  else if (value === "redo") editor.redo();
  else if (value === "bold") return chain.toggleBold().run();
  else if (value === "emphasis") return chain.toggleEmphasis().run();
  else if (value === "strike") return chain.toggleStrikethrough().run();
  else if (value === "inlineCode") return editor.run(toggleMdInlineCode(), target).ok;
  else if (value === "list" || value === "ordered" || value === "task") editor.run(toggleMdList(value === "list" ? "bullet" : value), target);
  else if (["insertedText", "highlight", "subscript", "superscript"].includes(value)) {
    const marker = ({ insertedText: "++", highlight: "==", subscript: "~", superscript: "^" } as Record<string, string>)[value]!;
    const node = ({ insertedText: "InsertedText", highlight: "Highlight", subscript: "Subscript", superscript: "Superscript" } as Record<string, string>)[value]!;
    return editor.run(toggleSourceMark({ node, marker, markerNode: `${node}Mark` }), target).ok;
  } else if (value === "indent") chain.indentList().run();
  else if (value === "outdent") chain.outdentList().run();
  else if (value === "row" || value === "row-after") chain.insertTableRow("after").run();
  else if (value === "row-before") chain.insertTableRow("before").run();
  else if (value === "column" || value === "column-after") chain.insertTableColumn("after").run();
  else if (value === "column-before") chain.insertTableColumn("before").run();
  else if (value === "delete-row") chain.deleteTableRow().run();
  else if (value === "delete-column") chain.deleteTableColumn().run();
  else if (value === "footnote") editor.run(insertMdFootnote(""), target);
  else if (value === "export" || value === "exportReview") {
    // Full serialization happens only on this explicit file action, never on input; opted-in text links become real links.
    void linkifyTextLinks(editor.state).catch(() => editor.getMarkdown())
      .then(markdown => value === "exportReview" ? getMdCommentsBridge(editor)?.exportReview(markdown) ?? markdown : markdown).then((markdown) => {
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = mdExportFileName(editor, "md"); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
}
