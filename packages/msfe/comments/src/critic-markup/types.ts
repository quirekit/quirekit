import type { CommentPerson, CommentsExchange } from "../protocol/types";

/** Half-open source interval of one Markdown construct. */
export interface SyntaxRange {
  /** Start offset. */
  readonly from: number;
  /** End offset. */
  readonly to: number;
}

/** Markdown structure that review marks must not split or enter. */
export interface MarkdownSyntax {
  /** Code blocks and HTML blocks, whose text is literal. */
  readonly blocks: readonly SyntaxRange[];
  /** Inline code, raw HTML and autolinks, whose text is literal. */
  readonly inline: readonly SyntaxRange[];
  /** Inline constructs such as emphasis and links that a mark must wrap completely. */
  readonly units: readonly SyntaxRange[];
}

/** Choices for writing comments into a Markdown copy. */
export interface CriticMarkupExportOptions {
  /** Also write resolved threads; defaults to false. */
  readonly includeResolved?: boolean;
}

/** Why a thread was written differently or not at all. */
export type CriticMarkupExportIssue =
  | { readonly id: string; readonly reason: "resolved" | "orphaned" }
  | { readonly id: string; readonly reason: "point" | "merged" };

/** Markdown copy with review marks, and what could not be expressed exactly. */
export interface CriticMarkupExport {
  /** Markdown with `{==…==}{>>…<<}` marks. */
  readonly markdown: string;
  /** Threads written, in source order. */
  readonly written: readonly string[];
  /** Threads written as a point comment, or merged into a neighbouring point comment. */
  readonly degraded: readonly CriticMarkupExportIssue[];
  /** Threads not written. */
  readonly skipped: readonly CriticMarkupExportIssue[];
}

/** How addition, deletion and substitution marks are applied on import. */
export type CriticMarkupSuggestions = "keep" | "accept" | "reject";

/** Choices for reading review marks out of Markdown. */
export interface CriticMarkupImportOptions {
  /** Author for comments without an `@name:` prefix. */
  readonly author: CommentPerson;
  /** @param name - Name from an `@name:` prefix. @returns Host identity; defaults to a `criticmarkup:` id. */
  readonly resolveAuthor?: (name: string) => CommentPerson;
  /** Suggestion handling; `keep` leaves the marks in the source. Defaults to `keep`. */
  readonly suggestions?: CriticMarkupSuggestions;
  /** @returns New unique identity; defaults to a random UUID. */
  readonly createId?: () => string;
  /** @returns Current ISO 8601 UTC time; defaults to the system clock. */
  readonly now?: () => string;
}

/** Clean Markdown and the comments found in it. */
export interface CriticMarkupImport {
  /** Markdown without comment and highlight marks. */
  readonly markdown: string;
  /** Comments anchored to `markdown`. */
  readonly comments: CommentsExchange;
  /** Highlights without a comment; their text is kept and the mark dropped. */
  readonly highlights: number;
  /** Addition, deletion and substitution marks found. */
  readonly suggestions: number;
}
