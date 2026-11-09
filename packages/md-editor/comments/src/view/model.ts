import type { CommentPerson, CommentThreadView } from "@quirekit/msfe-comments";
import type { MdCommentAuthor, MdCommentCardModel, MdCommentCardOptions, MdCommentListPresentation } from "../types";

/**
 * @param person - Stored author or the current user.
 * @param options - Host avatar lookup.
 * @returns Display identity for the shared avatar.
 */
export function commentAuthor(person: CommentPerson, options: Pick<MdCommentCardOptions, "avatar">): MdCommentAuthor {
  const avatar = options.avatar?.(person);
  return { name: person.name, ...(avatar ? { avatar } : {}), ...(person.agent ? { badge: "AI" } : {}) };
}

/**
 * Maps a controller view to card props; edit follows authorship and delete adds the host's `canDelete`, mirroring the controller's own checks.
 * @param view - Thread with placement.
 * @param options - Host user and permission.
 * @param documentLabel - Quote label of a comment on the whole document.
 * @param lineAt - One-based source line of an offset, read when an action runs so it follows later edits.
 * @returns Card model.
 */
export function commentCardModel(view: CommentThreadView, options: MdCommentCardOptions, documentLabel?: string, lineAt?: (position: number) => number): MdCommentCardModel {
  const { thread } = view, user = options.user, writer = !!user && options.canComment !== false;
  const exact = thread.anchor?.quote.exact ?? "";
  // A fenced block reads as "language: first lines" rather than raw fence syntax.
  const quote = exact.replace(/^(`{3,}|~{3,})\s*([\w-]*)[^\n]*\n/u, (_, _fence, language: string) => language ? `${language}: ` : "")
    .replace(/\n(`{3,}|~{3,})\s*$/u, "").replace(/\s+/gu, " ").trim();
  return {
    id: thread.id, view, quote, resolved: thread.resolved, resolvable: view.resolvable, replyable: writer,
    actions: (options.actions ?? []).filter(action => action.visible?.(view) ?? true).map(({ id, label, icon, run }) => ({ id, label, icon,
      run: () => run({ ...view, ...(view.range && lineAt ? { startLine: lineAt(view.range.from), endLine: lineAt(view.range.to) } : {}) }) })),
    quoteState: view.status === "orphaned" ? "unavailable" : view.status === "detached" ? "deleted" : exact ? "text" : "point",
    ...(view.status === "document" && documentLabel ? { quoteLabel: documentLabel } : {}),
    messages: thread.messages.map(message => {
      const own = writer && message.author.id === user!.id;
      return { id: message.id, author: commentAuthor(message.author, options), time: message.createdAt, body: message.body,
        edited: !!message.editedAt, editable: own, deletable: own || writer && !!options.canDelete?.(thread, message),
        ...(message.mentions ? { mentions: message.mentions } : {}) };
    }),
  };
}

/** Editor width that keeps a readable column beside the comment rail. */
const defaultSideMinWidth = 1040;

/**
 * @param width - Measured editor width.
 * @param minWidth - Host threshold, when configured.
 * @returns Whether the comment rail fits beside the document.
 */
export function commentRailFits(width: number, minWidth = defaultSideMinWidth): boolean {
  return width >= minWidth;
}

/**
 * Picks how the list of every comment appears, so it never covers the page when the rail column can hold it.
 * @param surface - Whether the rail column is available, and the editor's mobile and reading states.
 * @returns The list presentation.
 */
export function commentListPresentation(surface: { readonly railAvailable: boolean; readonly narrow: boolean; readonly reading: boolean }): MdCommentListPresentation {
  if (surface.narrow) return "sheet";
  return surface.railAvailable && !surface.reading ? "dock" : "drawer";
}
