import { Map as YMap, type Doc } from "yjs";
import { validateCommentsExchange } from "../protocol/validate";
import type { CommentAnchor, CommentMessage, CommentThread } from "../protocol/types";

/**
 * Room layout: `threads` maps thread ids to a Y.Map holding `anchor` (exchange anchor), `resolution`
 * (resolved flag, by, at) and `messages` (a Y.Map of message ids to messages). Each field is its own
 * last-writer-wins value, so concurrent replies to one thread both survive.
 */
const ANCHOR = "anchor", RESOLUTION = "resolution", MESSAGES = "messages";

/** Hash accepted by validation when a stored anchor lacks one; the anchor itself is then rejected. */
const PLACEHOLDER_HASH = "fnv1a64:0000000000000000";

/** @param value - Untrusted value. @returns Whether it is a non-array object. */
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }

/** @param left - Message. @param right - Message. @returns Creation order, ties broken by id for a deterministic result on every client. */
function byCreation(left: CommentMessage, right: CommentMessage): number {
  return left.createdAt < right.createdAt ? -1 : left.createdAt > right.createdAt ? 1 : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** @param room - Comment document. @returns Its thread map. */
export function roomThreads(room: Doc): YMap<unknown> { return room.getMap("threads"); }

/** @param map - Stored thread. @returns Its stored anchor, unvalidated. */
export function storedAnchor(map: unknown): CommentAnchor | undefined {
  return map instanceof YMap && record(map.get(ANCHOR)) ? map.get(ANCHOR) as CommentAnchor : undefined;
}

/**
 * Reads one thread written by any client. Replies whose parent was deleted concurrently, or that sort before
 * their parent under clock skew, hang off the root instead of dropping the thread.
 * @param id - Thread id.
 * @param map - Stored thread.
 * @returns A validated thread, or null when the stored data is not a valid thread.
 */
export function readThread(id: string, map: unknown): CommentThread | null {
  if (!(map instanceof YMap)) return null;
  const anchor = map.get(ANCHOR), resolution = map.get(RESOLUTION), messages = map.get(MESSAGES);
  if (!record(resolution) || !(messages instanceof YMap)) return null;
  const list = [...messages.values()].filter(record).map(item => item as unknown as CommentMessage).sort(byCreation);
  const root = list.find(message => message.parentId === null);
  if (!root) return null;
  const seen = new Set([root.id]), ordered: CommentMessage[] = [root];
  for (const message of list) {
    if (message === root) continue;
    ordered.push(seen.has(message.parentId as string) ? message : { ...message, parentId: root.id });
    seen.add(message.id);
  }
  // A thread without an anchor is a document comment, valid under version 2.
  const thread = { id, ...(anchor === undefined ? {} : { anchor }), ...resolution, messages: ordered } as unknown as CommentThread;
  const hash = record(anchor) && typeof anchor.hash === "string" ? anchor.hash : PLACEHOLDER_HASH;
  return validateCommentsExchange({ format: "quirekit.comments", version: 2, source: { hash }, threads: [thread] }).ok ? thread : null;
}

/** @param map - Target map. @param key - Field. @param value - JSON value, written only when it differs. */
function put(map: YMap<unknown>, key: string, value: unknown): void {
  if (JSON.stringify(map.get(key)) !== JSON.stringify(value)) map.set(key, value);
}

/**
 * Writes a thread's messages and resolution, changing only fields that differ; the anchor is written separately
 * because text edits move ranges without rewriting the room.
 * @param threads - Room thread map.
 * @param thread - Local thread.
 * @param anchor - Anchor for a new or re-placed thread; omitted to keep the stored one.
 */
export function writeThread(threads: YMap<unknown>, thread: CommentThread, anchor?: CommentAnchor): void {
  let map = threads.get(thread.id);
  if (!(map instanceof YMap)) { map = new YMap(); threads.set(thread.id, map); }
  const target = map as YMap<unknown>;
  const written = anchor ?? thread.anchor;
  if (written && (anchor || !record(target.get(ANCHOR)))) put(target, ANCHOR, written);
  put(target, RESOLUTION, { resolved: thread.resolved, ...(thread.resolvedBy ? { resolvedBy: thread.resolvedBy } : {}),
    ...(thread.resolvedAt ? { resolvedAt: thread.resolvedAt } : {}) });
  let messages = target.get(MESSAGES);
  if (!(messages instanceof YMap)) { messages = new YMap(); target.set(MESSAGES, messages); }
  const stored = messages as YMap<unknown>, kept = new Set(thread.messages.map(message => message.id));
  for (const message of thread.messages) put(stored, message.id, message);
  for (const key of [...stored.keys()]) if (!kept.has(key)) stored.delete(key);
}

/** @param threads - Room thread map. @param id - Thread. @param anchor - New anchor; nothing is written for a document comment. */
export function writeAnchor(threads: YMap<unknown>, id: string, anchor: CommentAnchor | undefined): void {
  const map = threads.get(id);
  if (anchor && map instanceof YMap) put(map, ANCHOR, anchor);
}
