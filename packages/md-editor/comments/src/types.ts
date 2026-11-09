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
  /** Editor width in pixels from which comments sit beside the document instead of in the list. Defaults to 1040, for hosts with a narrower editor area. */
  readonly sideMinWidth?: number;
  /** Where comments on the whole document appear besides the comment list: `end` adds a section after the document. Defaults to the list only. */
  readonly documentComments?: "end" | false;
  /** Host buttons on each comment card, before resolve; shown while the card is hovered, focused or active. */
  readonly actions?: readonly MdCommentAction[];
}

/** A host command offered on comment cards. */
export interface MdCommentAction {
  /** Stable identity among the actions. */
  readonly id: string;
  /** Accessible name and tooltip. */
  readonly label: string;
  /** Registered QuireKit icon name. */
  readonly icon: string;
  /**
   * @param view - Thread and its current placement.
   * @returns Whether this thread offers the action; omitted means every thread.
   */
  readonly visible?: (view: CommentThreadView) => boolean;
  /** @param context - Thread the action was chosen on. */
  readonly run: (context: MdCommentActionContext) => void;
}

/** The thread handed to a comment action, with its current source lines. */
export interface MdCommentActionContext extends CommentThreadView {
  /** One-based source line where the commented text starts; absent without a source range. */
  readonly startLine?: number | undefined;
  /** One-based source line where the commented text ends; absent without a source range. */
  readonly endLine?: number | undefined;
}

/** A comment action bound to one card. */
export interface MdCommentCardAction {
  /** Stable identity among the actions. */
  readonly id: string;
  /** Accessible name and tooltip. */
  readonly label: string;
  /** Registered QuireKit icon name. */
  readonly icon: string;
  /** Runs the action on this card's thread. */
  readonly run: () => void;
}

/** How the list of every comment appears: in the rail column, as a side drawer, or as a mobile bottom sheet. */
export type MdCommentListPresentation = "dock" | "drawer" | "sheet";

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
  /** Host buttons this thread offers. */
  readonly actions: readonly MdCommentCardAction[];
  /** Source view. */
  readonly view: CommentThreadView;
}

/** Comment options that shape how cards present authors and rights. */
export type MdCommentCardOptions = Pick<MdCommentsOptions, "user" | "canComment" | "canDelete" | "avatar" | "actions">;

/** Draft author shown before the first message exists. */
export type MdCommentAuthor = QuireKitCommentAuthor;
