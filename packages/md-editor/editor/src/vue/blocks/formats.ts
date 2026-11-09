import type { QuireKitToolbarEntry, QuireKitToolbarRow } from "@quirekit/ui";
import type { SourceBlockControls } from "@quirekit/msfe-core";
import { convertMdBlock } from "../../commands/block";
import type { MdEditorLocale } from "../types";
import { mdEditorMessages } from "../messages";
import { blockLabels } from "./labels";

/** @param controls - Exact captured block intent. @param locale - Product language. @returns Only installed, lossless conversions; evaluated while the menu is mounted. */
export function blockFormatRows(controls: SourceBlockControls, locale: MdEditorLocale): readonly QuireKitToolbarRow[] {
  const text = mdEditorMessages[locale], { editor, block, target } = controls;
  const kinds = ["paragraph", "h1", "h2", "h3", "h4", "h5", "h6", "bullet", "ordered", "task", "quote", "code"] as const;
  const icons: Record<string, string> = { paragraph: "type", bullet: "listBullet", ordered: "listNumbered", task: "listTodo", quote: "textQuote", code: "codeXml" };
  const task = block.name === "BulletList" && /^\s*[-+*]\s+\[[ xX]\]/u.test(editor.state.sliceDoc(block.from, Math.min(block.to, block.from + 64)));
  const current = /^(ATXHeading[1-6]|SetextHeading[12])$/u.test(block.name) ? `h${block.name.slice(-1)}` : task ? "task"
    : ({ Paragraph: "paragraph", Blockquote: "quote", BulletList: "bullet", OrderedList: "ordered", FencedCode: "code" } as Record<string, string>)[block.name];
  const features: Record<string, string> = { paragraph: "paragraph", quote: "blockquote", bullet: "listMarkers", ordered: "listMarkers", task: "taskItem", code: "code-block" };
  const items: QuireKitToolbarEntry[] = kinds.filter(kind => (kind === "paragraph" || Object.hasOwn(editor.storage, kind.startsWith("h") ? "heading" : features[kind]!))
    && editor.can(convertMdBlock(block, kind), target)).map(kind => ({ value: kind, kind: "toggle", pressed: current === kind, label: text[kind === "bullet" ? "list" : kind],
    icon: kind.startsWith("h") ? (kind === "h1" ? "heading" : `heading${kind.slice(1)}`) : icons[kind]!,
  }));
  // Six per row: the twelve conversions fill two even rows.
  return Array.from({ length: Math.ceil(items.length / 6) }, (_, row) => ({ value: `row-${row}`, label: blockLabels(locale).format, items: items.slice(row * 6, row * 6 + 6) }));
}
