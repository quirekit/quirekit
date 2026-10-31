import type { Doc, Map as YMap, Text, Transaction as YTransaction, YEvent, YMapEvent } from "yjs";
import type { Transaction } from "@quirekit/cm-state";
import type { MsfeChangeEvent, MsfeEditor } from "@quirekit/msfe-core";
import type { CollaborationSession } from "@quirekit/msfe-collaboration";
import { hashCommentSource } from "../anchoring/hash";
import { createCommentAnchor } from "../anchoring/quote";
import { resolveCommentAnchor } from "../anchoring/resolve";
import { getComments } from "../extension/access";
import type { CommentAnchor, CommentRange, CommentThread } from "../protocol/types";
import { commentsEffect, commentsState } from "../state/slot";
import type { CommentOperation, CommentPlacement } from "../state/types";
import { encodeRelativeAnchor, resolveRelativeAnchor } from "./relative";
import { readThread, roomThreads, storedAnchor, writeAnchor, writeThread } from "./room";

/** Source text and its hash, computed at most once per batch. */
interface SourceContext {
  /** Canonical editor text. */
  readonly source: string;
  /** Hash of `source`. */
  readonly hash: string;
}

/**
 * Keeps one editor's comment state and one comment room in step. Local operations are written after the
 * editor accepts them; remote changes merge per thread and only re-resolve threads whose anchor changed,
 * so text edits never rewrite the room. Never touches the source document.
 */
export class CommentsRoomBinding {
  private readonly origin = Object.freeze({ source: "msfe-comments" });
  private readonly threads: YMap<unknown>;
  private readonly text: Text;
  /** Anchor JSON each local range was placed from; an unchanged remote anchor keeps the locally mapped range. */
  private readonly applied = new Map<string, string>();
  /** Room threads not yet merged, e.g. while composition blocks view updates. */
  private readonly dirty = new Set<string>();
  /** Threads whose endpoints reference source characters that have not arrived. */
  private readonly pending = new Set<string>();

  /** @param editor - Mounted editor. @param session - Source session. @param room - Comment document. */
  constructor(private readonly editor: MsfeEditor, private readonly session: CollaborationSession, private readonly room: Doc) {
    this.text = session.document.getText("source");
    this.threads = roomThreads(room);
    this.threads.observeDeep(this.received);
    this.start();
  }

  /** Stops observing the room; the room and its content stay with the host. */
  destroy(): void { this.threads.unobserveDeep(this.received); }

  /** @param transaction - Accepted editor transaction; local comment operations are written to the room. */
  transaction(transaction: Transaction): void {
    const operations = commentsEffect.values(transaction).filter(item => item.type !== "sync" && item.type !== "activate"
      && !(item.type === "place" && item.reason === "restore"));
    if (operations.length) this.publish(operations);
    if (this.dirty.size) this.flush();
  }

  /** @param event - Accepted source change; undo may need anchor repair and pending anchors may now resolve. */
  changed(event: MsfeChangeEvent): void {
    if (event.origin === "history") this.repair();
    if (this.pending.size) { for (const id of this.pending) this.dirty.add(id); this.pending.clear(); }
    if (this.dirty.size) this.flush();
  }

  /** @returns Current epoch, or null before admission. */
  private get epoch(): string | null { return this.session.manifest?.epoch ?? null; }

  /** @returns Whether shared text indices equal editor offsets right now. */
  private synced(): boolean { return this.text.length === this.editor.state.doc.length; }

  /** @returns Whether this client may rewrite anchors in the room. */
  private writable(): boolean { return getComments(this.editor)?.writable() ?? false; }

  /** @returns Lazily computed source context. */
  private context(): () => SourceContext {
    let value: SourceContext | undefined;
    return () => value ??= (source => ({ source, hash: hashCommentSource(source) }))(this.editor.state.doc.toString());
  }

  /** @param write - Room mutation, tagged so this binding ignores its own echo. */
  private write(write: () => void): void { this.room.transact(write, this.origin); }

  /** Loads the room; host imports after binding replace the room's threads through the `load` operation. */
  private start(): void {
    for (const id of this.threads.keys()) this.dirty.add(id);
    if (this.dirty.size) this.flush();
  }

  /**
   * @param thread - Thread. @param range - Current range. @param context - Source context.
   * @returns Fresh anchor with endpoints of the current epoch; a detached or orphaned thread keeps its last good anchor,
   * and a document comment has none.
   */
  private anchor(thread: CommentThread, range: CommentRange | undefined, context: () => SourceContext): CommentAnchor | undefined {
    if (!thread.anchor || !range || range.from === range.to && thread.anchor.quote.exact.length) return thread.anchor;
    let anchor: CommentAnchor;
    try { const { source, hash } = context(); anchor = createCommentAnchor(source, range, hash); } catch { return thread.anchor; }
    const epoch = this.epoch;
    if (epoch && this.synced()) anchor = { ...anchor, relative: encodeRelativeAnchor(this.text, range, epoch) };
    this.applied.set(thread.id, JSON.stringify(anchor));
    return anchor;
  }

  /** @param operations - Local operations accepted by the editor, in order. */
  private publish(operations: readonly CommentOperation[]): void {
    const state = commentsState.read(this.editor.state), context = this.context();
    const rangeOf = (id: string) => state.ranges.all().find(range => range.id === id);
    this.write(() => {
      for (const operation of operations) {
        if (operation.type === "create") writeThread(this.threads, operation.thread, this.anchor(operation.thread, operation.placement, context));
        else if (operation.type === "update") writeThread(this.threads, operation.thread);
        else if (operation.type === "delete") { this.threads.delete(operation.id); this.applied.delete(operation.id); }
        else if (operation.type === "place") for (const { id } of operation.placements) {
          const thread = state.threads.get(id);
          if (thread) writeAnchor(this.threads, id, this.anchor(thread, rangeOf(id), context));
        } else if (operation.type === "load") {
          const kept = new Set(operation.threads.map(thread => thread.id));
          for (const id of [...this.threads.keys()]) if (!kept.has(id)) this.threads.delete(id);
          for (const thread of operation.threads) writeThread(this.threads, thread, this.anchor(thread, rangeOf(thread.id), context));
        }
      }
    });
  }

  /** @param events - Room changes. @param transaction - Room transaction; this binding's own writes are skipped. */
  private readonly received = (events: YEvent<YMap<unknown>>[], transaction: YTransaction): void => {
    if (transaction.origin === this.origin) return;
    for (const event of events) {
      if (event.target === this.threads) for (const key of (event as YMapEvent<unknown>).keysChanged) this.dirty.add(key);
      else if (typeof event.path[0] === "string") this.dirty.add(event.path[0]);
    }
    this.flush();
  };

  /** Merges dirty room threads into the editor; anything the editor cannot accept yet stays dirty. */
  private flush(): void {
    if (!this.synced()) return;
    const state = commentsState.read(this.editor.state), context = this.context(), epoch = this.epoch;
    const threads: CommentThread[] = [], removed: string[] = [], placements: CommentPlacement[] = [], orphaned: string[] = [];
    const applied = new Map<string, string>(), rewrites: CommentPlacement[] = [], waiting: string[] = [];
    for (const id of this.dirty) {
      const thread = readThread(id, this.threads.get(id));
      if (!thread) { if (state.threads.has(id)) removed.push(id); continue; }
      const key = JSON.stringify(thread.anchor ?? null), known = state.threads.has(id);
      if (known && this.applied.get(id) === key) { threads.push(thread); continue; }
      // Document comments merge as data only; there is no position to resolve.
      if (!thread.anchor) { threads.push(thread); applied.set(id, key); continue; }
      // Phase 1: endpoints of the current epoch, resolved identically on every client.
      const relative = thread.anchor.relative && thread.anchor.relative.epoch === epoch ? resolveRelativeAnchor(this.text, thread.anchor.relative, false) : null;
      if (relative?.status === "pending") { waiting.push(id); if (known) threads.push(thread); continue; }
      threads.push(thread);
      if (relative?.status === "placed") { placements.push({ id, ...relative.range }); applied.set(id, key); continue; }
      // Phase 2: quote re-anchoring, written back so other clients converge on the same endpoints.
      const quote = resolveCommentAnchor(context().source, thread.anchor, context().hash);
      if (quote.status === "orphaned") { orphaned.push(id); applied.set(id, key); continue; }
      placements.push({ id, ...quote.range }); rewrites.push({ id, ...quote.range });
    }
    if (!this.editor.updateViewState({ effects: [commentsEffect.of({ type: "sync", threads, removed, placements, orphaned })] }).ok) return;
    this.dirty.clear();
    for (const id of waiting) this.pending.add(id);
    for (const id of removed) { this.applied.delete(id); this.pending.delete(id); }
    for (const [id, key] of applied) this.applied.set(id, key);
    for (const { id, ...range } of rewrites) {
      const thread = threads.find(item => item.id === id)!;
      if (this.writable()) this.write(() => writeAnchor(this.threads, id, this.anchor(thread, range, context)));
      else this.applied.set(id, JSON.stringify(thread.anchor));
    }
  }

  /**
   * After an undo or redo, the undoing client alone can follow recreated text. Threads whose followed range differs
   * from the shared resolution get the followed range locally, and new endpoints in the room for everyone else.
   */
  private repair(): void {
    const epoch = this.epoch, state = commentsState.read(this.editor.state);
    if (!epoch || !this.synced()) return;
    const placements: CommentPlacement[] = [];
    for (const [id, map] of this.threads.entries()) {
      const relative = storedAnchor(map)?.relative;
      if (!relative || relative.epoch !== epoch || !state.threads.has(id)) continue;
      const followed = resolveRelativeAnchor(this.text, relative, true), shared = resolveRelativeAnchor(this.text, relative, false);
      if (followed.status !== "placed" || shared.status === "placed" && shared.range.from === followed.range.from && shared.range.to === followed.range.to) continue;
      placements.push({ id, ...followed.range });
    }
    if (!placements.length || !this.editor.updateViewState({ effects: [commentsEffect.of({ type: "place", reason: "restore", placements })] }).ok) return;
    if (!this.writable()) return;
    const context = this.context();
    this.write(() => { for (const { id, ...range } of placements) writeAnchor(this.threads, id, this.anchor(state.threads.get(id)!, range, context)); });
  }
}
