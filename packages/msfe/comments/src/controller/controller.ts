import { v4 as uuid } from "uuid";
import type { Transaction } from "@quirekit/cm-state";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { hashCommentSource } from "../anchoring/hash";
import { createCommentAnchor } from "../anchoring/quote";
import type { CommentMessage, CommentPerson, CommentRange, CommentsExchange, CommentThread } from "../protocol/types";
import { commentsEffect, commentsState } from "../state/slot";
import type { CommentOperation, CommentsState } from "../state/types";
import { buildExport, prepareImport } from "./exchange";
import { notify } from "./notify";
import type { CommentFailure, CommentInput, CommentResult, CommentsImport, CommentsOptions, CommentThreadView } from "./types";

/** @param input - Composer output. @returns Whether it is a nonblank body with well-formed mentions. */
function validInput(input: CommentInput): boolean {
  return typeof input.body === "string" && input.body.trim().length > 0 && (input.mentions === undefined || Array.isArray(input.mentions)
    && input.mentions.every(item => typeof item?.id === "string" && typeof item.label === "string" && typeof item.url === "string"));
}

/**
 * Editor-owned comment operations. Every change is a text-neutral view update, so it works on readonly
 * sources and never enters text undo; permission checks here only mirror what the host must enforce.
 */
export class CommentsController {
  /** @param editor - Canonical editor. @param options - Host identity, permissions and change sink. */
  constructor(private readonly editor: MsfeEditor, private readonly options: CommentsOptions) {}

  /** @returns Current document-local state. */
  private get state(): CommentsState { return commentsState.read(this.editor.state); }

  /** @returns Document comments first, then threads in source order, orphaned ones last. */
  threads(): readonly CommentThreadView[] {
    const state = this.state, ranges = new Map(state.ranges.all().map(range => [range.id, range]));
    const views = [...state.threads.values()].map(thread => {
      const range = ranges.get(thread.id);
      const status = !thread.anchor ? "document" as const : !range ? "orphaned" as const
        : range.from === range.to && thread.anchor.quote.exact.length ? "detached" as const : "placed" as const;
      return { thread, range: range ? { from: range.from, to: range.to } : null, status, resolvable: this.resolvable(thread) };
    });
    /** @param view - Thread view. @returns Sort key: document comments before any source position. */
    const order = (view: CommentThreadView): number => view.status === "document" ? -Infinity : view.range?.from ?? Infinity;
    return views.sort((left, right) => order(left) - order(right));
  }

  /** @param position - Source offset. @returns Ids of unresolved threads whose range contains the offset. */
  threadsAt(position: number): readonly string[] {
    const state = this.state;
    return state.ranges.between(position, position).filter(range => !state.threads.get(range.id)?.resolved).map(range => range.id);
  }

  /** @returns Focused thread id. */
  active(): string | null { return this.state.active; }

  /** @returns Whether the current user may create and reply, for enabling entry points. */
  writable(): boolean { return typeof this.writer() !== "string"; }

  /**
   * @param input - Root message.
   * @param range - Source range, e.g. captured when a draft opened; defaults to the current main selection.
   * @returns New thread id.
   */
  add(input: CommentInput, range?: CommentRange): CommentResult {
    const user = this.writer(); if (typeof user === "string") return { ok: false, reason: user };
    if (!validInput(input)) return { ok: false, reason: "invalid-input" };
    const source = this.editor.state.doc.toString(), { from, to } = range ?? this.editor.state.selection.main;
    let anchor;
    try { anchor = createCommentAnchor(source, { from, to }, hashCommentSource(source)); } catch { return { ok: false, reason: "invalid-range" }; }
    const thread: CommentThread = { id: this.id(), anchor, resolved: false, messages: [this.message(null, input)] };
    return this.dispatch({ type: "create", thread, placement: { id: thread.id, from, to } }, thread.id);
  }

  /** @param input - Root message of a comment on the whole document. @returns New thread id. */
  addDocument(input: CommentInput): CommentResult {
    const user = this.writer(); if (typeof user === "string") return { ok: false, reason: user };
    if (!validInput(input)) return { ok: false, reason: "invalid-input" };
    const thread: CommentThread = { id: this.id(), resolved: false, messages: [this.message(null, input)] };
    return this.dispatch({ type: "create", thread }, thread.id);
  }

  /** @param threadId - Thread. @param input - Reply content. @returns New message id. */
  reply(threadId: string, input: CommentInput): CommentResult {
    const user = this.writer(); if (typeof user === "string") return { ok: false, reason: user };
    const thread = this.state.threads.get(threadId); if (!thread) return { ok: false, reason: "not-found" };
    if (!validInput(input)) return { ok: false, reason: "invalid-input" };
    // Replies hang off the root, matching Word's flat thread model.
    const message = this.message(thread.messages[0]!.id, input);
    return this.dispatch({ type: "update", kind: "reply", thread: { ...thread, messages: [...thread.messages, message] } }, message.id);
  }

  /** @param threadId - Thread. @param messageId - Own message. @param input - New content. @returns Edited message id. */
  edit(threadId: string, messageId: string, input: CommentInput): CommentResult {
    const found = this.own(threadId, messageId); if ("reason" in found) return { ok: false, reason: found.reason };
    if (!validInput(input)) return { ok: false, reason: "invalid-input" };
    const messages = found.thread.messages.map(message => {
      if (message.id !== messageId) return message;
      const { mentions: _previous, ...rest } = message;
      return { ...rest, body: input.body, editedAt: this.now(), ...(input.mentions ? { mentions: input.mentions } : {}) };
    });
    return this.dispatch({ type: "update", kind: "edit", thread: { ...found.thread, messages } }, messageId);
  }

  /** @param threadId - Thread to close. @returns Thread id. */
  resolve(threadId: string): CommentResult { return this.setResolved(threadId, true); }

  /** @param threadId - Thread to reopen. @returns Thread id. */
  reopen(threadId: string): CommentResult { return this.setResolved(threadId, false); }

  /**
   * Deleting the root message deletes the thread; deleting a reply re-parents its replies.
   * @param threadId - Thread. @param messageId - Own message, default the root. @returns Deleted id.
   */
  remove(threadId: string, messageId?: string): CommentResult {
    const thread = this.state.threads.get(threadId); if (!thread) return { ok: false, reason: "not-found" };
    const target = messageId ?? thread.messages[0]!.id;
    const found = this.own(threadId, target, true); if ("reason" in found) return { ok: false, reason: found.reason };
    if (target === thread.messages[0]!.id) return this.dispatch({ type: "delete", id: threadId }, threadId);
    const removed = found.message, messages = thread.messages.filter(message => message.id !== target)
      .map(message => message.parentId === target ? { ...message, parentId: removed.parentId } : message);
    return this.dispatch({ type: "update", kind: "delete-message", thread: { ...thread, messages } }, target);
  }

  /** @param threadId - Orphaned or misplaced thread. @returns Thread id, now on the current main selection. */
  reattach(threadId: string): CommentResult {
    const user = this.writer(); if (typeof user === "string") return { ok: false, reason: user };
    const thread = this.state.threads.get(threadId);
    if (!thread) return { ok: false, reason: "not-found" };
    // A document comment belongs to the whole document and never moves onto a selection.
    if (!thread.anchor) return { ok: false, reason: "invalid-range" };
    const { from, to } = this.editor.state.selection.main;
    return this.dispatch({ type: "place", reason: "reattach", placements: [{ id: threadId, from, to }] }, threadId);
  }

  /** @param threadId - Thread to focus, or null. @returns Whether the editor accepted it. */
  activate(threadId: string | null): boolean {
    if (this.editor.scope.disposed) return false;
    if (threadId === this.active()) return true;
    // Selection-driven highlights do not own the viewport. An old snapshot here
    // would replace a keyboard or outline target before native scrolling runs.
    return this.editor.updateViewState({ effects: [commentsEffect.of({ type: "activate", id: threadId })], preserveScroll: false }).ok;
  }

  /** @param value - Untrusted exchange data. @returns Report; on success every current thread is replaced. */
  importComments(value: unknown): CommentsImport {
    const prepared = prepareImport(value, this.editor.state.doc.toString());
    if (!prepared.ok) return { ok: false, reason: "invalid", issues: prepared.issues };
    const accepted = this.editor.updateViewState({ effects: [commentsEffect.of({ type: "load", threads: prepared.threads, placements: prepared.placements })] });
    return accepted.ok ? { ok: true, moved: prepared.moved, orphaned: prepared.orphaned } : { ok: false, reason: "unavailable" };
  }

  /** @returns Exchange document for the current source. */
  exportComments(): CommentsExchange { return buildExport(this.state, this.editor.state.doc.toString()); }

  /** @param transaction - Accepted transaction, reported to the host when it carries comment operations. */
  observe(transaction: Transaction): void {
    if (this.options.onChange) notify(commentsEffect.values(transaction), this.options.onChange, () => this.exportComments());
  }

  /** @param thread - Thread. @returns Whether resolve / reopen is offered. */
  private resolvable(thread: CommentThread): boolean {
    return !!this.options.user && this.options.canComment !== false && (this.options.canResolve?.(thread) ?? true);
  }

  /**
   * Facts an AI comment command writes with: whose request it acts on and the host's rules.
   * @returns Writing context, or why the current user may not have comments written.
   */
  agentContext(): { readonly requestedBy: CommentPerson; readonly canResolve: (thread: CommentThread) => boolean; readonly id: () => string; readonly now: () => string } | CommentFailure {
    const user = this.writer(); if (typeof user === "string") return user;
    return { requestedBy: user, canResolve: thread => this.resolvable(thread), id: () => this.id(), now: () => this.now() };
  }

  /** @param threadId - Thread. @param resolved - Target state. @returns Thread id. */
  private setResolved(threadId: string, resolved: boolean): CommentResult {
    const user = this.writer(); if (typeof user === "string") return { ok: false, reason: user };
    const thread = this.state.threads.get(threadId); if (!thread) return { ok: false, reason: "not-found" };
    if (!this.resolvable(thread)) return { ok: false, reason: "not-permitted" };
    const { resolvedBy: _by, resolvedAt: _at, ...open } = thread;
    const next = resolved ? { ...open, resolved, resolvedBy: user, resolvedAt: this.now() } : { ...open, resolved };
    return this.dispatch({ type: "update", kind: resolved ? "resolve" : "reopen", thread: next }, threadId);
  }

  /** @returns The writing user, or why writing is refused. */
  private writer(): CommentPerson | "no-user" | "not-permitted" {
    if (!this.options.user) return "no-user";
    return this.options.canComment === false ? "not-permitted" : this.options.user;
  }

  /**
   * @param threadId - Thread. @param messageId - Message. @param removing - Whether the host's `canDelete` may also allow it.
   * @returns The message when written by the current user, or when removing a message the host lets the user delete.
   */
  private own(threadId: string, messageId: string, removing = false): { readonly thread: CommentThread; readonly message: CommentMessage } | { readonly reason: CommentFailure } {
    const user = this.writer(); if (typeof user === "string") return { reason: user };
    const thread = this.state.threads.get(threadId), message = thread?.messages.find(item => item.id === messageId);
    if (!thread || !message) return { reason: "not-found" };
    const allowed = message.author.id === user.id || removing && (this.options.canDelete?.(thread, message) ?? false);
    return allowed ? { thread, message } : { reason: "not-permitted" };
  }

  /** @param parentId - Replied message. @param input - Content. @returns New message by the current user. */
  private message(parentId: string | null, input: CommentInput): CommentMessage {
    return { id: this.id(), parentId, author: this.options.user!, createdAt: this.now(), body: input.body, ...(input.mentions ? { mentions: input.mentions } : {}) };
  }

  /** @param operation - Change. @param id - Reported identity. @returns Result of the view update. */
  private dispatch(operation: CommentOperation, id: string): CommentResult {
    return this.editor.updateViewState({ effects: [commentsEffect.of(operation)] }).ok ? { ok: true, id } : { ok: false, reason: "unavailable" };
  }

  /** @returns New identity. */
  private id(): string { return this.options.createId?.() ?? uuid(); }

  /** @returns Current UTC time. */
  private now(): string { return this.options.now?.() ?? new Date().toISOString(); }
}
