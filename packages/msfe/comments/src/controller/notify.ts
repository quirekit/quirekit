import type { CommentsExchange } from "../protocol/types";
import type { CommentOperation } from "../state/types";
import type { CommentChange, CommentChangeKind } from "./types";

/**
 * Reports user-visible comment operations; loads, focus changes and undo restorations stay silent.
 * @param operations - Operations carried by one accepted transaction.
 * @param listener - Host change sink.
 * @param snapshot - Lazy exchange builder shared by all changes of the transaction.
 */
export function notify(operations: readonly CommentOperation[], listener: (change: CommentChange) => void, snapshot: () => CommentsExchange): void {
  /** @param kind - Operation kind. @param threadId - Thread. */
  const emit = (kind: CommentChangeKind, threadId: string): void => listener({ kind, threadId, snapshot });
  for (const operation of operations) {
    if (operation.type === "create") emit("create", operation.thread.id);
    else if (operation.type === "update") emit(operation.kind, operation.thread.id);
    else if (operation.type === "delete") emit("delete", operation.id);
    else if (operation.type === "place" && operation.reason === "reattach") for (const placement of operation.placements) emit("reattach", placement.id);
  }
}
