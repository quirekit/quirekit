import { hashCommentSource } from "../anchoring/hash";
import { resolveCommentAnchor } from "../anchoring/resolve";
import type { CommentMessage, CommentsExchange, CommentThread } from "../protocol/types";
import { containing, overlaps, scanMarkdown, wrapUnits } from "./syntax";
import type { CriticMarkupExport, CriticMarkupExportIssue, CriticMarkupExportOptions } from "./types";

/** One thread's planned marks; `from === to` with `point` set means a lone comment. */
interface Placement {
  readonly thread: CommentThread;
  from: number;
  to: number;
  point: boolean;
  /** Text inserted before a lone comment, keeping a code block's container prefix. */
  lead: string;
}

/** Insertion at one offset; at equal offsets closes come first, then lone comments, then opens. */
interface Edit {
  readonly at: number;
  readonly rank: number;
  readonly text: string;
}

/** @param message - Comment message. @returns `@name: body` on one line, never closing the mark early. */
function annotation(message: CommentMessage): string {
  const name = message.author.name.replace(/[:\n]/gu, " ").trim();
  return `{>>@${name}: ${message.body.replace(/\s*\n\s*/gu, " ").replaceAll("<<}", "<< }")}<<}`;
}

/** @param thread - Thread. @returns Root and replies as consecutive comment marks. */
const annotations = (thread: CommentThread) => thread.messages.map(annotation).join("");

/**
 * Writes comments into a copy of the Markdown as CriticMarkup. Marks never enter code or split inline syntax;
 * ranges that cannot be wrapped become lone comments, and every such change is reported.
 * @param markdown - Source the comments belong to.
 * @param comments - Exchange data, re-anchored on `markdown`.
 * @param options - Export choices.
 * @returns Marked copy and report.
 */
export function exportCriticMarkup(markdown: string, comments: CommentsExchange, options: CriticMarkupExportOptions = {}): CriticMarkupExport {
  const syntax = scanMarkdown(markdown), hash = hashCommentSource(markdown), literal = [...syntax.blocks, ...syntax.inline];
  const skipped: CriticMarkupExportIssue[] = [], degraded: CriticMarkupExportIssue[] = [], placements: Placement[] = [];
  // Phase 1: place each thread on this source and shrink it to what a mark can wrap without breaking syntax.
  const documents: CommentThread[] = [];
  for (const thread of comments.threads) {
    if (thread.resolved && !options.includeResolved) { skipped.push({ id: thread.id, reason: "resolved" }); continue; }
    if (!thread.anchor) { documents.push(thread); continue; }
    const resolved = resolveCommentAnchor(markdown, thread.anchor, hash);
    if (resolved.status === "orphaned") { skipped.push({ id: thread.id, reason: "orphaned" }); continue; }
    let { from, to } = resolved.range, point = from === to;
    if (!point) {
      ({ from, to } = wrapUnits(syntax.units, { from, to }));
      const text = markdown.slice(from, to);
      if (text.includes("\n") || text.includes("==}") || overlaps(literal, from, to)) { point = true; to = from; degraded.push({ id: thread.id, reason: "point" }); }
    }
    placements.push({ thread, from, to: point ? from : to, point, lead: "" });
  }
  placements.sort((left, right) => left.from - right.from);
  // Phase 2: resolve conflicts in source order; marks cannot nest, and adjacent lone comments would read as replies.
  let previous: Placement | undefined;
  const taken = new Set<number>();
  for (const item of placements) {
    if (previous && !previous.point && item.from < previous.to) {
      if (!item.point) degraded.push({ id: item.thread.id, reason: "point" });
      item.point = true; item.from = item.to = previous.to;
    }
    if (item.point) {
      const block = containing(syntax.blocks, item.from) ?? syntax.blocks.find(range => range.from === item.from);
      const inline = containing(syntax.inline, item.from);
      if (block) {
        const lineStart = markdown.lastIndexOf("\n", block.from - 1) + 1, prefix = markdown.slice(lineStart, block.from);
        item.from = item.to = block.from; item.lead = `\n${prefix}\n${prefix}`;
      } else if (inline) item.from = item.to = inline.to;
      // A lone comment right after a highlight's comments would be read back as a reply; it moves before the highlight.
      const closing = placements.find(other => !other.point && other.to === item.from);
      if (closing) item.from = item.to = closing.from;
      if (taken.has(item.from)) degraded.push({ id: item.thread.id, reason: "merged" });
      taken.add(item.from);
    }
    if (!item.point) previous = item;
  }
  // Phase 3: splice marks into the source in one ascending pass.
  const edits: Edit[] = [];
  for (const item of placements) {
    if (item.point) edits.push({ at: item.from, rank: 1, text: annotations(item.thread) + item.lead });
    else edits.push({ at: item.from, rank: 2, text: "{==" }, { at: item.to, rank: 0, text: `==}${annotations(item.thread)}` });
  }
  edits.sort((left, right) => left.at - right.at || left.rank - right.rank);
  let out = "", at = 0;
  for (const edit of edits) { out += markdown.slice(at, edit.at) + edit.text; at = edit.at; }
  out += markdown.slice(at);
  // Document comments have no text to wrap; each becomes its own paragraph at the end of the file.
  if (documents.length) out += `${out.endsWith("\n") || !out ? "" : "\n"}${documents.map(thread => `\n${annotations(thread)}\n`).join("")}`;
  return { markdown: out, written: [...documents, ...placements.map(item => item.thread)].map(thread => thread.id), degraded, skipped };
}
