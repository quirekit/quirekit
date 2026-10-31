import { quireAiLineBreak } from "../edit/text";
import { formatQuireAiProperties } from "../view/inline";
import type { QuireAiSegment, QuireAiTransformPlacement } from "./types";

/** Protocol tokens in an answer. */
const tokenPattern = /<t(\d+)>([\s\S]*?)<\/t\1>|<x\d+\/>|<br\/>/gu;

/**
 * Writes the edit operation for one transformed segment.
 *
 * The program writes all edit markup: tagged words get their run's formats
 * beyond the shared ones, characters that would read as markup are escaped,
 * and line breaks stay line breaks inside the paragraph. A new paragraph copies the block's
 * paragraph and shared character formats through `like`; a replacement restates
 * the shared formats, because `replace` writes bare text. After a numbered block such
 * as a list item, the result continues inside it on a new line, so it takes no number.
 *
 * @param segment - Source segment.
 * @param text - Checked answer text; tags already validated or removed.
 * @param placement - Where the result goes.
 * @returns `document_edit` operation.
 */
export function buildQuireAiTransformOperation(segment: QuireAiSegment, text: string, placement: QuireAiTransformPlacement): Record<string, unknown> {
  let markup = "";
  let last = 0;
  for (const match of text.matchAll(tokenPattern)) {
    markup += escapeMarkup(text.slice(last, match.index));
    const [token, tag, inner] = match;
    if (tag !== undefined) markup += formatted(inner!, difference(segment.tags.get(Number(tag)) ?? {}, segment.shared));
    else if (token === "<br/>") markup += quireAiLineBreak;
    last = match.index + token.length;
  }
  markup += escapeMarkup(text.slice(last));
  if (placement === "after" && segment.numbered) return { op: "append", block: segment.block, text: quireAiLineBreak + wrap(markup, segment.shared) };
  if (placement === "after") return { op: "insert", after: segment.block, blocks: [{ text: markup, like: segment.block }] };
  // Shared formats never overlap a tag's own formats, so the outer span cannot override an inner one.
  return { op: "replace", block: segment.block, text: wrap(markup, segment.shared) };
}

/**
 * @param text - Answer text inside one tag.
 * @param formats - Formats beyond the shared ones.
 * @returns Escaped text in a format span, or plain when nothing differs.
 */
function formatted(text: string, formats: Readonly<Record<string, unknown>>): string {
  return wrap(escapeMarkup(text.replace(/<x\d+\/>/gu, "")).replaceAll("<br/>", quireAiLineBreak), formats);
}

/**
 * @param markup - Escaped markup.
 * @param formats - Formats to apply to all of it.
 * @returns `[markup]{formats}`, or the markup when there are none.
 */
function wrap(markup: string, formats: Readonly<Record<string, unknown>>): string {
  const properties = formatQuireAiProperties(new Map(Object.entries(formats)));
  return properties === "" || markup === "" ? markup : `[${markup}]${properties}`;
}

/**
 * @param formats - A run's formats.
 * @param shared - Formats every run shares.
 * @returns Formats of the run that are not shared.
 */
function difference(formats: Readonly<Record<string, unknown>>, shared: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(formats).filter(([name, value]) => JSON.stringify(shared[name]) !== JSON.stringify(value)));
}

/**
 * @param text - Plain text.
 * @returns Text with characters that start or end markup escaped.
 */
function escapeMarkup(text: string): string {
  return text.replace(/[\\*[\]]/gu, character => `\\${character}`);
}
