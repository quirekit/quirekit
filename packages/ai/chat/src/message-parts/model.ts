import type { AiChatExecutionTraceEntry, AiChatMessagePart } from "../types";

/** Text-bearing chronological part kind. */
export type AiChatTextMessagePartKind =
  | "content"
  | "reasoning";

/**
 * Appends a text delta to the active tail part or starts a new chronological part.
 *
 * A trace event between two text deltas forces a new text part, preserving the
 * exact visible order instead of moving all reasoning or content into one region.
 *
 * @param parts - Current immutable message parts.
 * @param kind - Public reasoning or assistant content.
 * @param id - Stable id used only when a new tail part is required.
 * @param delta - Newly arrived provider text.
 * @returns Updated immutable part sequence.
 */
export function appendAiChatTextMessagePart(
  parts: readonly AiChatMessagePart[],
  kind: AiChatTextMessagePartKind,
  id: string,
  delta: string
): readonly AiChatMessagePart[] {
  if (delta.length === 0) return parts;
  const last = parts.at(-1);
  if (last?.kind === kind) {
    const content = `${last.content}${delta}`;
    return Object.freeze([
      ...parts.slice(0, -1),
      Object.freeze(kind !== "content"
        ? { ...last, content, status: "streaming" as const }
        : { ...last, content })
    ]);
  }
  return Object.freeze([
    ...parts,
    Object.freeze(kind !== "content"
      ? { id, kind, status: "streaming" as const, content: delta }
      : { id, kind, content: delta })
  ]);
}

/**
 * Upserts one trace snapshot without moving its original chronological slot.
 *
 * @param parts - Current immutable message parts.
 * @param entry - Latest trace lifecycle snapshot.
 * @returns Updated immutable part sequence.
 */
export function upsertAiChatTraceMessagePart(
  parts: readonly AiChatMessagePart[],
  entry: AiChatExecutionTraceEntry
): readonly AiChatMessagePart[] {
  const id = `trace:${entry.id}`;
  const index = parts.findIndex(part => part.kind === "trace" && part.id === id);
  const previous = index === -1 ? undefined : parts[index];
  const mergedEntry = previous?.kind === "trace"
    ? Object.freeze({ ...previous.entry, ...entry })
    : entry;
  const part = Object.freeze({ id, kind: "trace" as const, entry: mergedEntry });
  if (index === -1) return Object.freeze([...parts, part]);
  return Object.freeze(parts.map((current, currentIndex) => (
    currentIndex === index ? part : current
  )));
}

/**
 * Finalizes streamed reasoning and appends any non-streamed terminal content.
 *
 * @param parts - Current immutable chronological parts.
 * @param finalContent - Authoritative final assistant content.
 * @param nextId - Allocates ids for terminal-only parts.
 * @returns Completed immutable part sequence.
 */
export function finalizeAiChatMessageParts(
  parts: readonly AiChatMessagePart[],
  finalContent: string,
  nextId: (kind: AiChatTextMessagePartKind) => string
): readonly AiChatMessagePart[] {
  let result = Object.freeze(parts.map(part => (
    part.kind === "reasoning"
      ? Object.freeze({ ...part, status: "available" as const })
      : part
  ))) as readonly AiChatMessagePart[];
  const streamedContent = result
    .filter(part => part.kind === "content")
    .map(part => part.content)
    .join("");
  if (finalContent.length > 0 && !streamedContent.endsWith(finalContent)) {
    const lastContent = [...result].reverse().find(part => part.kind === "content");
    if (lastContent?.kind === "content" && finalContent.startsWith(lastContent.content)) {
      result = appendAiChatTextMessagePart(
        result,
        "content",
        nextId("content"),
        finalContent.slice(lastContent.content.length)
      );
    } else {
      result = Object.freeze([
        ...result,
        Object.freeze({ id: nextId("content"), kind: "content" as const, content: finalContent })
      ]);
    }
  }
  return Object.freeze([...result]);
}
