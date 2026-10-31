import type { CommentPerson, CommentsOptions, CommentThreadView } from "@quirekit/msfe-comments";
import type { CriticMarkupSuggestions } from "@quirekit/msfe-comments/critic-markup";
import type { QuireKitCommentAuthor, QuireKitCommentMessage, QuireKitCommentQuoteState } from "@quirekit/ui/vue";

/** Host comment configuration; storage and permission rules stay with the host. */
export interface MdCommentsOptions extends Pick<CommentsOptions, "user" | "canComment" | "canResolve" | "canDelete" | "onChange"> {
  /**
   * @param person - Message author or the current user.
   * @returns Avatar image URL; without one the avatar shows initials. Called while rendering, so a reactive lookup updates the cards.
   */
  readonly avatar?: (person: CommentPerson) => string | undefined;
  /** CriticMarkup at the file boundary, off unless set; `true` enables both directions with defaults. */
  readonly criticMarkup?: boolean | MdCriticMarkupOptions;
  /** Where comments on the whole document appear besides the comment list: `end` adds a section after the document. Defaults to the list only. */
  readonly documentComments?: "end" | false;
}

/** CriticMarkup file actions. Comments stay stand-off in the editor; marks exist only in exported or imported files. */
export interface MdCriticMarkupOptions {
  /** Offers “Markdown (with comments)” in the export menu. Defaults to true. */
  readonly export?: boolean;
  /** Reads comment marks when Markdown is imported. Defaults to true. */
  readonly import?: boolean;
  /** Also exports resolved threads. Defaults to false. */
  readonly includeResolved?: boolean;
  /** Addition, deletion and substitution marks on import: kept as text, accepted or rejected. Defaults to `keep`. */
  readonly suggestions?: CriticMarkupSuggestions;
}

/** Props a thread card receives, derived from one controller view. */
export interface MdCommentCardModel {
  /** Thread identity. */
  readonly id: string;
  /** Messages with per-user edit and delete rights. */
  readonly messages: readonly QuireKitCommentMessage[];
  /** Quoted text. */
  readonly quote: string;
  /** Quote presentation. */
  readonly quoteState: QuireKitCommentQuoteState;
  /** Label replacing the quote, e.g. for a comment on the whole document. */
  readonly quoteLabel?: string | undefined;
  /** Whether the thread is closed. */
  readonly resolved: boolean;
  /** Whether resolve / reopen is offered. */
  readonly resolvable: boolean;
  /** Whether a reply field is offered. */
  readonly replyable: boolean;
  /** Source view. */
  readonly view: CommentThreadView;
}

/** Comment options that shape how cards present authors and rights. */
export type MdCommentCardOptions = Pick<MdCommentsOptions, "user" | "canComment" | "canDelete" | "avatar">;

/** Draft author shown before the first message exists. */
export type MdCommentAuthor = QuireKitCommentAuthor;
