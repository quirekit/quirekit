import { v4 as uuidv4 } from "uuid";
import type { AiChatMessage, AiChatMessagePart, AiChatSnapshot, AiChatDocumentEvent } from "../types";
import type { ChatState } from "./types";

/** Allocate a product identity independently of provider or document IDs.
 * @param kind - Identity family.
 * @returns Unique product identity.
 */
export function createChatId(kind: string): string {
  return `${kind}-${uuidv4()}`;
}

/** Publish one immutable snapshot to current subscribers.
 * @param state - Controller internals.
 * @param patch - Changed presentation fields.
 */
export function publish(state: ChatState, patch: Partial<AiChatSnapshot>): void {
  if (state.destroyed) return;
  state.snapshot = Object.freeze({ ...state.snapshot, ...patch });
  for (const listener of state.listeners) {
    try { listener(state.snapshot); } catch { /* A detached view cannot fail a document operation. */ }
  }
}

/** Replace one visible message while preserving all others' identities.
 * @param state - Controller internals.
 * @param id - Message identity.
 * @param patch - Updated fields.
 */
export function updateChatMessage(state: ChatState, id: string, patch: Partial<AiChatMessage>): void {
  publish(state, { messages: state.snapshot.messages.map(message => message.id === id ? { ...message, ...patch } : message) });
}

/** Retain authoritative document effects and reviews separately from model success.
 * @param state - Controller internals.
 * @param event - Public SDK fact.
 */
export function acceptDocumentEvent(state: ChatState, event: AiChatDocumentEvent): void {
  if (state.destroyed) return;
  const operationId = event.type === "operation" ? event.operation.id
    : event.type === "preview" ? event.preview.operationId
    : "operationId" in event ? event.operationId : undefined;
  const knownOwner = operationId === undefined ? undefined : state.snapshot.operationMessageIds[operationId]
    ?? state.snapshot.messages.find(message => message.parts?.some(part => part.kind === "trace" && part.entry.operationId === operationId))?.id;
  const messageId = knownOwner ?? state.active?.messageId;
  const operationMessageIds = operationId !== undefined && messageId !== undefined
    ? { ...state.snapshot.operationMessageIds, [operationId]: messageId } : state.snapshot.operationMessageIds;
  let reviews = state.snapshot.reviews;
  let part: AiChatMessagePart | undefined;
  if (event.type === "preview") {
    if (!reviews.some(review => review.preview.id === event.preview.id)) {
      reviews = [...reviews, { messageId: messageId ?? "document", preview: event.preview, state: "pending" }];
      part = { id: `review:${event.preview.id}`, kind: "review", reviewId: event.preview.id };
    }
  } else if (event.type === "preview-settled") {
    reviews = reviews.map(review => review.preview.id === event.previewId
      ? { ...review, state: event.decision === "cancelled" ? "expired" : event.decision } : review);
  } else if (event.type === "operation") {
    part = { id: `operation:${event.operation.id}`, kind: "document", operationId: event.operation.id };
  }
  // The first event reserves its chronological position. Later snapshots update
  // facts only, so subsequent model text cannot grow above a trailing receipt.
  const messages = part === undefined ? state.snapshot.messages : state.snapshot.messages.map(message => {
    if (message.id !== messageId || message.parts?.some(previous => previous.id === part.id)) return message;
    return { ...message, parts: [...(message.parts ?? []), part] };
  });
  // Progress is replaceable, whereas receipts and final outcomes remain durable facts.
  const events = state.snapshot.documentEvents.filter(previous => !(event.type === "operation" && previous.type === "operation" && previous.operation.id === event.operation.id)
    && !(event.type === "progress" && previous.type === "progress" && previous.operationId === event.operationId));
  publish(state, { messages, reviews, operationMessageIds, documentEvents: [...events, event] });
}
