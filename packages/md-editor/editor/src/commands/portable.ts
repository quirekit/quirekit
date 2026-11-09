import { EditorSelection } from "@quirekit/cm-state";
import { encodeMarkdownDestination, encodeMarkdownField, isSafeDestination, type MsfeCommand } from "@quirekit/msfe-core";
import type { MdDocumentLink, MdMention } from "./types";

/** @param text - Literal Unicode text chosen by a user. @returns One selection-local source transaction. */
export function insertMdText(text: string): MsfeCommand {
  return state => {
    if (state.selection.ranges.length !== 1 || !text || /[\r\n\u0000-\u001f]/u.test(text)) return null;
    const { from, to } = state.selection.main;
    return { changes: { from, to, insert: text }, selection: EditorSelection.cursor(from + text.length), scrollIntoView: true };
  };
}

/** @param value - Plain ISO calendar date, without time-zone conversion. @returns A validated text insertion or an inapplicable command. */
export function insertMdDate(value: string): MsfeCommand {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  const date = new Date(`${value}T12:00:00Z`);
  if (!match || !Number(match[1]) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return () => null;
  return insertMdText(value);
}

/** @param mention - A host-resolved contact. @returns A standard Markdown link, with no hidden identity model or notification side effect. */
export function insertMdMention(mention: MdMention): MsfeCommand {
  const source = mdMentionSource(mention);
  return source ? insertMdText(source) : () => null;
}

/** @param mention - A validated host contact. @returns Its portable Markdown link, or null for unsafe/incomplete values. */
export function mdMentionSource(mention: MdMention): string | null {
  if (!mention.id.trim() || !mention.label.trim() || /[\r\n]/u.test(mention.label + mention.url)
    || !mention.url.trim() || !isSafeDestination(mention.url, false)) return null;
  const label = encodeMarkdownField(mention.label.replace(/^@/u, ""), "[]*_`<>");
  return `[@${label}](${encodeMarkdownDestination(mention.url)})`;
}

/** @param link - A validated host document. @returns Its portable Markdown link, or null for unsafe/incomplete values. */
export function mdDocumentLinkSource(link: MdDocumentLink): string | null {
  if (!link.id.trim() || !link.label.trim() || /[\r\n]/u.test(link.label + link.url)
    || !link.url.trim() || !isSafeDestination(link.url, false)) return null;
  return `[${encodeMarkdownField(link.label, "[]*_`<>")}](${encodeMarkdownDestination(link.url)})`;
}

/** @param link - A validated host document. @returns A command replacing the target range with the document link. */
export function insertMdDocumentLink(link: MdDocumentLink): MsfeCommand {
  const source = mdDocumentLinkSource(link);
  return source ? insertMdText(source) : () => null;
}
