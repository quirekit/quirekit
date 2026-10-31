import type { CommentPerson, CommentThreadView } from "@quirekit/msfe-comments";
import type { MdCommentAuthor, MdCommentCardModel, MdCommentCardOptions } from "../types";

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
 * @returns Card model.
 */
export function commentCardModel(view: CommentThreadView, options: MdCommentCardOptions, documentLabel?: string): MdCommentCardModel {
  const { thread } = view, user = options.user, writer = !!user && options.canComment !== false;
  const exact = thread.anchor?.quote.exact ?? "";
  // A fenced block reads as "language: first lines" rather than raw fence syntax.
  const quote = exact.replace(/^(`{3,}|~{3,})\s*([\w-]*)[^\n]*\n/u, (_, _fence, language: string) => language ? `${language}: ` : "")
    .replace(/\n(`{3,}|~{3,})\s*$/u, "").replace(/\s+/gu, " ").trim();
  return {
    id: thread.id, view, quote, resolved: thread.resolved, resolvable: view.resolvable, replyable: writer,
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
