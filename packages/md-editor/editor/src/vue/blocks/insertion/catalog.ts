import type { QuireKitMenuEntry } from "@quirekit/ui";
import { canInsertSourceBlock, SOURCE_CARET, type MsfeEditor } from "@quirekit/msfe-core";
import { queryFootnotes } from "@quirekit/msfe-markdown-extras";
import type { MdEditorLocale } from "../../types";
import { mdEditorMessages } from "../../messages";
import { insertionItems } from "../../toolbar/insertion";
import { insertionBlocks } from "../../toolbar/blocks";

/** @param editor - Installed source capabilities. @param locale - Product language. @param mentions - Whether host contacts are available. @param atSelection - Free caret insertion instead of an explicit block boundary. @returns Full shared insertion catalog, without unavailable features. */
export function blockInsertionItems(editor: MsfeEditor, locale: MdEditorLocale, mentions = false, atSelection = false): readonly QuireKitMenuEntry[] {
  const text = mdEditorMessages[locale];
  const blockDisabled = atSelection && !canInsertSourceBlock(editor.state);
  return [{ value: "text", label: text.format, kind: "group", children: blockDisabled ? [] : [
    { value: "insert-paragraph", label: text.paragraph, icon: "type" },
    ...(Object.hasOwn(editor.storage, "heading") ? [1, 2, 3, 4, 5, 6].map(level => ({ value: `insert-h${level}`, label: text[`h${level}` as "h1"], icon: level === 1 ? "heading" : `heading${level}` })) : []),
  ] }, ...insertionItems(editor, locale, new Set(), atSelection).map(group => ({ ...group, children: (group.children ?? []).filter(item => !item.disabled && (item.value !== "footnote" || queryFootnotes(editor.state).status === "ready")) })),
  { value: "inline", label: text.common, kind: "group", children: [
    { value: "date", label: text.date, icon: "calendarDays" }, { value: "emoji", label: text.emoji, icon: "smile" },
    ...(mentions ? [{ value: "mention", label: text.mention, icon: "atSign" }] : []),
  ] }].filter(group => group.children?.length) as readonly QuireKitMenuEntry[];
}

/** @param editor - Current footnote namespace. @param locale - New content language. @param value - Shared insertion identity. @returns Immediate source payload (empty opens a paragraph), null when a parameter editor is needed. */
export function blockInsertionSource(editor: MsfeEditor, locale: MdEditorLocale, value: string): string | null {
  if (value === "insert-paragraph") return "";
  if (/^insert-h[1-6]$/u.test(value)) return `${"#".repeat(Number(value.slice(-1)))} `;
  if (value === "footnote") {
    const index = queryFootnotes(editor.state);
    if (index.status !== "ready") return null;
    let number = 1; while (index.entries.has(`note-${number}`)) number++;
    return `[^note-${number}]\n\n[^note-${number}]: ${SOURCE_CARET}`;
  }
  return insertionBlocks(locale).find(item => value === `insert-${item.id}`)?.source ?? null;
}
