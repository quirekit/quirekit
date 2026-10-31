import { createAbsolutePositionFromRelativePosition, createRelativePositionFromJSON, createRelativePositionFromTypeIndex, getState,
  type RelativePosition, type Text } from "yjs";
import type { CommentRange, CommentRelativeAnchor } from "../protocol/types";
import type { RelativeResolution } from "./types";

/** Shared Markdown text name used by the source collaboration binding. */
const SOURCE = "source";

/** @param value - Untrusted value. @returns Whether it is a non-array object. */
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }

/** @param position - Yjs relative position. @returns Plain JSON endpoint, without class instances. */
function toJson(position: RelativePosition): unknown {
  return { tname: SOURCE, assoc: position.assoc, ...(position.item ? { item: { client: position.item.client, clock: position.item.clock } } : {}) };
}

/** @param value - Stored endpoint from any client. @returns A position on the root source text, or null when malformed. */
function endpoint(value: unknown): RelativePosition | null {
  if (!record(value) || value.tname !== SOURCE || value.type != null || ![-1, 0].includes(value.assoc as number)) return null;
  const item = value.item;
  if (item != null && !(record(item) && Number.isSafeInteger(item.client) && (item.client as number) >= 0 && (item.client as number) <= 0xffffffff
    && Number.isSafeInteger(item.clock) && (item.clock as number) >= 0)) return null;
  return createRelativePositionFromJSON({ tname: SOURCE, item: item ?? null, assoc: value.assoc });
}

/**
 * Encodes a range so typing at either edge stays outside: the start sticks to the first quoted character,
 * the end to the last one; a point sticks to the character after it.
 * @param text - Shared source text, in sync with the editor.
 * @param range - Source range.
 * @param epoch - Current collaboration epoch.
 * @returns Serializable endpoints.
 */
export function encodeRelativeAnchor(text: Text, range: CommentRange, epoch: string): CommentRelativeAnchor {
  const end = range.from === range.to ? 0 : -1;
  return { start: toJson(createRelativePositionFromTypeIndex(text, range.from, 0)), end: toJson(createRelativePositionFromTypeIndex(text, range.to, end)), epoch };
}

/**
 * @param text - Shared source text.
 * @param relative - Stored endpoints of the current epoch.
 * @param followUndoneDeletions - Only the client that ran an undo may follow it; shared resolution passes false.
 * @returns Range, `pending` while referenced characters have not arrived, or `invalid`.
 */
export function resolveRelativeAnchor(text: Text, relative: CommentRelativeAnchor, followUndoneDeletions: boolean): RelativeResolution {
  const doc = text.doc, start = endpoint(relative.start), end = endpoint(relative.end);
  if (!doc || !start || !end) return { status: "invalid" };
  // A missing item is either not yet received (pending) or already collected (invalid, fall back to the quote).
  for (const position of [start, end]) if (position.item && getState(doc.store, position.item.client) <= position.item.clock) return { status: "pending" };
  const from = createAbsolutePositionFromRelativePosition(start, doc, followUndoneDeletions);
  const to = createAbsolutePositionFromRelativePosition(end, doc, followUndoneDeletions);
  if (from?.type !== text || to?.type !== text) return { status: "invalid" };
  return { status: "placed", range: { from: from.index, to: Math.max(from.index, to.index) } };
}
