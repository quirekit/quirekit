import { v4 as uuid } from "uuid";
import { hashCommentSource } from "../anchoring/hash";
import { createCommentAnchor } from "../anchoring/quote";
import type { CommentMessage, CommentPerson, CommentThread } from "../protocol/types";
import { containing, scanMarkdown } from "./syntax";
import type { CriticMarkupImport, CriticMarkupImportOptions } from "./types";

/** Opening delimiter to closing delimiter. */
const CLOSE: Readonly<Record<string, string>> = { "{++": "++}", "{--": "--}", "{~~": "~~}", "{==": "==}", "{>>": "<<}" };
const OPEN = /\{(?:\+\+|--|~~|==|>>)/gu;
/** Container prefix allowed before a comment that occupies its own line. */
const PREFIX = /^[ \t>]*$/u;

/** A thread found in the source, positioned in the cleaned output. */
interface Found {
  readonly from: number;
  readonly to: number;
  readonly notes: readonly string[];
  /** A comment on the whole document, read from the trailing comment paragraphs. */
  readonly document?: boolean;
}

/** A line made only of comment marks. */
const COMMENT_LINE = /^[ \t]*(?:\{>>[\s\S]*?<<\}[ \t]*)+$/u;

/**
 * Splits off the comment-only paragraphs that end the file, where exports write document comments.
 * @param markdown - Markdown.
 * @returns The rest of the file, and each trailing comment line's notes.
 */
function trailingComments(markdown: string): { readonly body: string; readonly notes: readonly (readonly string[])[] } {
  const lines = markdown.split("\n"), notes: string[][] = [];
  let last = lines.length - 1;
  for (; last >= 0; last--) {
    const line = lines[last]!;
    if (!line.trim()) continue;
    if (!COMMENT_LINE.test(line)) break;
    notes.unshift(commentRun(line, line.indexOf("{>>")).notes);
  }
  // Only a separate paragraph counts; a comment right under text is a point comment there.
  if (!notes.length || last >= 0 && lines[last + 1]?.trim()) return { body: markdown, notes: [] };
  return { body: last < 0 ? "" : `${lines.slice(0, last + 1).join("\n")}\n`, notes };
}

/**
 * @param source - Markdown.
 * @param at - Offset of `{>>`.
 * @returns Bodies of the consecutive comment marks starting there, and the offset after them.
 */
function commentRun(source: string, at: number): { readonly notes: string[]; readonly end: number } {
  const notes: string[] = [];
  let end = at;
  while (source.startsWith("{>>", end)) {
    const close = source.indexOf("<<}", end + 3);
    if (close < 0) break;
    notes.push(source.slice(end + 3, close)); end = close + 3;
  }
  return { notes, end };
}

/**
 * Reads CriticMarkup comments into stand-off comments and removes their marks. Marks inside code are literal text.
 * Highlights keep their text; suggestions are kept, accepted or rejected as asked.
 * Comment-only paragraphs at the end of the file become document comments.
 * @param input - Markdown that may contain review marks.
 * @param options - Authors, suggestion policy, identity and clock.
 * @returns Clean Markdown, comments anchored to it, and counts of what was dropped or kept.
 */
export function importCriticMarkup(input: string, options: CriticMarkupImportOptions): CriticMarkupImport {
  const trailing = trailingComments(input), markdown = trailing.body;
  const syntax = scanMarkdown(markdown), policy = options.suggestions ?? "keep", found: Found[] = [];
  let out = "", at = 0, highlights = 0, suggestions = 0;
  OPEN.lastIndex = 0;
  for (let match = OPEN.exec(markdown); match; match = OPEN.exec(markdown)) {
    const start = match.index, literal = containing(syntax.blocks, start) ?? containing(syntax.inline, start);
    if (literal || start < at) { if (literal) OPEN.lastIndex = literal.to; continue; }
    const open = match[0], close = markdown.indexOf(CLOSE[open]!, start + 3);
    if (close < 0) continue;
    const content = markdown.slice(start + 3, close);
    let end = close + 3;
    out += markdown.slice(at, start);
    if (open === "{>>") {
      const run = commentRun(markdown, start);
      end = run.end;
      // A comment alone on its line is removed with the line and one following blank line, as exports place it.
      const lineStart = markdown.lastIndexOf("\n", start - 1) + 1, lineEnd = markdown.indexOf("\n", end);
      if (lineStart >= at && lineEnd >= 0 && PREFIX.test(markdown.slice(lineStart, start)) && !markdown.slice(end, lineEnd).trim()) {
        out = out.slice(0, out.length - (start - lineStart)); end = lineEnd + 1;
        const nextEnd = markdown.indexOf("\n", end);
        if (nextEnd >= 0 && PREFIX.test(markdown.slice(end, nextEnd))) end = nextEnd + 1;
      }
      found.push({ from: out.length, to: out.length, notes: run.notes });
    } else if (open === "{==") {
      const from = out.length; out += content;
      const run = commentRun(markdown, end);
      if (run.notes.length) { found.push({ from, to: out.length, notes: run.notes }); end = run.end; } else highlights++;
    } else {
      suggestions++;
      const [before, after] = open === "{~~" ? [content.split("~>")[0] ?? "", content.split("~>").slice(1).join("~>")] : open === "{++" ? ["", content] : [content, ""];
      out += policy === "keep" ? markdown.slice(start, end) : policy === "accept" ? after : before;
    }
    at = end; OPEN.lastIndex = end;
  }
  out += markdown.slice(at);
  for (const notes of trailing.notes) found.unshift({ from: 0, to: 0, notes, document: true });
  const result = threads(out, found, options);
  return { markdown: out, comments: { format: "quirekit.comments", version: result.some(thread => !thread.anchor) ? 2 : 1, source: { hash: hashCommentSource(out) }, threads: result },
    highlights, suggestions };
}

/**
 * @param source - Clean Markdown.
 * @param found - Comment runs with their output ranges.
 * @param options - Authors, identity and clock.
 * @returns Threads with the first note as root and the rest as replies to it.
 */
function threads(source: string, found: readonly Found[], options: CriticMarkupImportOptions): CommentThread[] {
  const hash = hashCommentSource(source), id = options.createId ?? uuid, now = options.now ?? (() => new Date().toISOString());
  const person = options.resolveAuthor ?? ((name: string): CommentPerson => ({ id: `criticmarkup:${name}`, name }));
  const result: CommentThread[] = [];
  for (const item of found) {
    const messages: CommentMessage[] = [];
    for (const note of item.notes) {
      const signed = /^@([^:\n]{1,80}):\s?([\s\S]*)$/u.exec(note.trim()), body = (signed ? signed[2]! : note).trim();
      if (!body) continue;
      messages.push({ id: id(), parentId: messages[0]?.id ?? null, author: signed ? person(signed[1]!.trim()) : options.author, createdAt: now(), body });
    }
    if (messages.length) result.push({ id: id(), ...(item.document ? {} : { anchor: createCommentAnchor(source, item, hash) }), resolved: false, messages });
  }
  return result;
}
