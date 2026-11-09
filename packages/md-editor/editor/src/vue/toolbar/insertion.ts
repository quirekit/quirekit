import type { QuireKitMenuEntry } from "@quirekit/ui";
import { canInsertSourceBlock, type MsfeEditor } from "@quirekit/msfe-core";
import { insertionBlocks } from "./blocks";
import { mdEditorMessages } from "../messages";
import type { MdEditorLocale } from "../types";
import { canEditMdLink } from "../../commands/destination";

/** Insertions the full toolbar already shows as its own buttons; its insert menu omits them. */
export const toolbarInsertions: ReadonlySet<string> = new Set(["image", "link", "insert-table", "insert-code", "insert-list", "insert-ordered", "insert-task"]);

/** @param value - Product action identity. @returns Whether the action creates a block rather than inline content. */
export function isBlockInsertionIntent(value: string): boolean {
  return value.startsWith("insert-") || ["dataView", "textDiagram", "mermaid", "flowchart", "mindMap", "whiteboard", "displayMath"].includes(value);
}

/**
 * @param editor - Installed source capabilities.
 * @param locale - Control language.
 * @param omit - Values already reachable elsewhere in the same surface; emptied groups are dropped.
 * @param atSelection - Whether to check the caret; explicit block/blank-line menus validate their own boundary.
 * @returns Grouped commands using the shared icon registry.
 */
export function insertionItems(editor: MsfeEditor, locale: MdEditorLocale, omit: ReadonlySet<string> = new Set(), atSelection = true): readonly QuireKitMenuEntry[] {
  const text = mdEditorMessages[locale];
  /** @param name - Public extension storage key. @returns Whether its source command is installed. */
  const installed = (name: string): boolean => Object.hasOwn(editor.storage, name);
  const icons: Record<string, string> = { quote: "textQuote", list: "listBullet", ordered: "listNumbered", task: "listTodo",
    table: "table", code: "codeXml", note: "circleInfo", warning: "circleAlert", details: "chevronRight", highlight: "lightbulb", nested: "layers", divider: "horizontalRule", definition: "bookOpen" };
  const blocks = insertionBlocks(locale).filter(block => installed(block.feature)).map(block => ({ value: `insert-${block.id}`, label: block.label, icon: icons[block.id] }));
  const groups: QuireKitMenuEntry[] = [
    { value: "common", label: text.common, kind: "group", children: [
      { value: "image", label: text.image, icon: "image", disabled: !installed("image") },
      { value: "link", label: text.link, icon: "link", disabled: !installed("link") || atSelection && !canEditMdLink(editor.state) },
      {value: "dataView", label: locale === "en" ? "Database" : "多维表格", icon: "database", disabled: !installed("dataView")},
      ...blocks.filter(block => ["insert-table", "insert-code", "insert-quote", "insert-divider"].includes(block.value)),
    ] },
    { value: "diagrams", label: text.diagrams, kind: "group", children: [
      { value: "textDiagram", label: text.textDiagram, icon: "textDiagram", disabled: !installed("textDiagram") && !installed("mermaid") },
      { value: "flowchart", label: text.flow, icon: "workflow", disabled: !installed("flowchart") },
      { value: "mindMap", label: text.mindmap, icon: "mindMap", disabled: !installed("mindMap") },
      { value: "whiteboard", label: locale === "en" ? "Whiteboard" : "白板", icon: "whiteboard", disabled: !installed("whiteboard") },
      { value: "inlineMath", label: text.inlineMath, icon: "sigma", disabled: !installed("math") },
      { value: "displayMath", label: text.displayMath, icon: "superscriptSquare", disabled: !installed("math") },
    ] },
    { value: "structure", label: text.structure, kind: "group", children: blocks.filter(block => !["insert-table", "insert-code", "insert-quote", "insert-divider"].includes(block.value)) },
    { value: "references", label: text.references, kind: "group", children: [
      { value: "footnote", label: text.footnote, icon: "footnote", disabled: !installed("footnotes") },
    ] },
  ];
  const blockDisabled = atSelection && !canInsertSourceBlock(editor.state);
  return groups.map(group => ({ ...group, children: (group.children ?? []).filter(item => !omit.has(item.value))
    .map(item => ({ ...item, disabled: !!item.disabled || blockDisabled && isBlockInsertionIntent(item.value) })) }))
    .filter(group => group.children.length);
}
