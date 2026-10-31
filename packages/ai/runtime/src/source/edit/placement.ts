import type { QuireAiSourceDocument } from "../types";
import type { QuireAiSourceSnapshot, QuireAiSourceViewBlock } from "../view/types";
import { QuireAiSourceOperationFailure, type QuireAiSourceDraft } from "./draft";
import { stripQuireAiSourceIndent } from "../view/snapshot";
import { indentQuireAiMarkdown, lineStartOf } from "./text";

/** Where new blocks go. */
export type QuireAiSourceAnchor =
  | { readonly kind: "after" | "before"; readonly block: QuireAiSourceViewBlock }
  | { readonly kind: "start" | "end" };

/**
 * @param snapshot - Snapshot.
 * @param block - A list item.
 * @returns Items of the same list at the same depth, in order.
 */
function siblingsOf(snapshot: QuireAiSourceSnapshot, block: QuireAiSourceViewBlock, draft?: QuireAiSourceDraft): QuireAiSourceViewBlock[] {
  return snapshot.blocks.filter(item => item.kind === "list-item" && item.list === block.list && item.depth === block.depth
    && (draft === undefined || item === block || draft.alive(item)));
}

/**
 * @param snapshot - Snapshot.
 * @param block - A list item.
 * @returns Separator between the list's items: a blank line for a loose list, else a line break.
 */
function listSeparator(snapshot: QuireAiSourceSnapshot, block: QuireAiSourceViewBlock): string {
  const items = siblingsOf(snapshot, block);
  const loose = items.some((item, index) => index > 0 && snapshot.text.slice(items[index - 1]!.end, item.from).includes("\n\n"));
  return loose ? "\n\n" : "\n";
}

/**
 * @param document - Source document port.
 * @param texts - New Markdown pieces.
 * @returns Whether every top-level block they hold is a list item.
 */
function isListMarkdown(document: QuireAiSourceDocument, texts: readonly string[]): boolean {
  return texts.every(text => {
    const blocks = document.segment(text).filter(block => block.depth === 0);
    return blocks.length > 0 && blocks.every(block => block.kind === "list-item");
  });
}

/**
 * Inserts new Markdown blocks at an anchor, adding the separators and container indentation.
 * @param draft - Draft to change.
 * @param snapshot - Snapshot the model read.
 * @param document - Source document port, to tell list items apart.
 * @param anchor - Where the blocks go.
 * @param texts - Normalized Markdown pieces, each one or more blocks.
 */
export function insertQuireAiSourceBlocks(draft: QuireAiSourceDraft, snapshot: QuireAiSourceSnapshot, document: QuireAiSourceDocument,
  anchor: QuireAiSourceAnchor, texts: readonly string[]): void {
  // Blocks an earlier operation of this call removed anchor nothing.
  const topLevel = snapshot.blocks.filter(block => block.depth === 0 && draft.alive(block));
  if (anchor.kind === "start" || anchor.kind === "end") {
    const first = topLevel[0];
    // New blocks go after front matter, which must stay the first thing in the file.
    if (anchor.kind === "start" && first !== undefined && first.kind !== "front-matter") {
      insertQuireAiSourceBlocks(draft, snapshot, document, { kind: "before", block: first }, texts);
      return;
    }
    const last = anchor.kind === "start" ? first : topLevel.at(-1);
    if (last !== undefined) {
      insertQuireAiSourceBlocks(draft, snapshot, document, { kind: "after", block: last }, texts);
      return;
    }
    const at = draft.text.trimEnd().length;
    draft.change([{ from: at, to: draft.text.length, insert: `${at === 0 ? "" : "\n\n"}${texts.join("\n\n")}\n` }]);
    return;
  }
  const target = (anchor as { readonly block: QuireAiSourceViewBlock }).block;
  const located = draft.locate(target);
  if (target.kind === "list-item") {
    const siblings = siblingsOf(snapshot, target, draft);
    if (isListMarkdown(document, texts)) {
      const separator = listSeparator(snapshot, target);
      const content = texts.map(text => indentQuireAiMarkdown(text, target.indent, true)).join(separator);
      if (anchor.kind === "after") draft.change([{ from: located.after, to: located.after, insert: separator + content }]);
      else {
        const start = lineStartOf(draft.text, located.from);
        draft.change([{ from: start, to: start, insert: content + separator }]);
      }
      return;
    }
    // Other blocks can only go outside the list, next to its first or last item.
    const edge = anchor.kind === "after" ? siblings.at(-1) : siblings[0];
    if (target.depth > 0 || edge?.id !== target.id) {
      throw new QuireAiSourceOperationFailure("invalid-input", `${target.id} is inside a list: insert list items there, each starting with a marker such as "- ", or insert other blocks ${anchor.kind} the list's ${anchor.kind === "after" ? "last" : "first"} item.`);
    }
  }
  const content = texts.join("\n\n");
  if (anchor.kind === "after") draft.change([{ from: located.after, to: located.after, insert: `\n\n${content}` }]);
  else {
    const start = lineStartOf(draft.text, located.from);
    draft.change([{ from: start, to: start, insert: `${content}\n\n` }]);
  }
}

/**
 * Removes adjacent blocks of one level with their nested blocks and one separator, so the blocks
 * around them keep a single separator and a list stays one list.
 * @param draft - Draft to change.
 * @param snapshot - Snapshot the model read.
 * @param first - First block removed.
 * @param last - Last block removed.
 * @returns Removed source as the view lists it, without the container indentation.
 */
export function removeQuireAiSourceBlocks(draft: QuireAiSourceDraft, snapshot: QuireAiSourceSnapshot,
  first: QuireAiSourceViewBlock, last: QuireAiSourceViewBlock): string {
  const start = lineStartOf(draft.text, draft.locate(first).from);
  const end = draft.locate(last).end;
  const removed = stripQuireAiSourceIndent(draft.text.slice(start + first.indent.length, end), first.indent);
  const text = draft.text;
  let from = start;
  let to = end;
  const nextSibling = first.kind === "list-item"
    ? siblingsOf(snapshot, first, draft).find(item => item.from > last.from) : undefined;
  const followed = first.kind === "list-item" ? nextSibling !== undefined : text.slice(end).trim() !== "";
  if (followed) {
    // Take the separator after the blocks; the next block moves up to their line.
    while (to < text.length && text[to] === "\n") to += 1;
    if (first.kind === "list-item") to = lineStartOf(text, draft.locate(nextSibling!).from);
  } else {
    // Last of its level: take the separator before, so nothing after joins the previous block.
    while (from > 0 && text[from - 1] === "\n") from -= 1;
    if (from === 0) while (to < text.length && text[to] === "\n") to += 1;
  }
  draft.change([{ from, to, insert: "" }]);
  return removed;
}
