import { defineCommand, type CommandProps, type MsfeCommandAgentContext } from "@quirekit/msfe-core";
import { hashCommentSource } from "../anchoring/hash";
import { createCommentAnchor } from "../anchoring/quote";
import type { CommentsController } from "../controller/controller";
import type { CommentFailure } from "../controller/types";
import type { CommentPerson, CommentThread } from "../protocol/types";
import { commentsEffect, commentsState } from "../state/slot";

/** Input of an AI comment command, prepared by its adapter. */
export interface AgentCommentInput {
  /** Identity the AI writes as. */
  readonly author: CommentPerson;
  /** Thread to act on, for replies and decisions. */
  readonly thread?: string | undefined;
  /** Message body, for new comments and replies. */
  readonly body?: string | undefined;
}

/** JSON Schema of a message body. */
const bodyParams = {
  type: "object",
  properties: { body: { type: "string", minLength: 1, maxLength: 4000, description: "Comment text; inline Markdown allowed." } },
  required: ["body"],
  additionalProperties: false
} as const;

/** Explanations of refusals, for the model to tell the user. */
const refusals: Readonly<Record<CommentFailure, string>> = {
  "no-user": "comments are read-only here because no user is signed in",
  "not-permitted": "the user may not write or resolve these comments",
  "not-found": "the comment thread no longer exists",
  "invalid-input": "the comment text is empty",
  "invalid-range": "the commented text is not in the document",
  unavailable: "comments are not available"
};

/**
 * @param controller - Comment controller.
 * @param author - Identity the AI core writes as.
 * @param thread - Thread the command acts on, when it decides one.
 * @param resolve - Whether the command resolves or reopens the thread.
 * @returns The AI author; throws the reason when the user's permissions do not allow it.
 */
function agentAuthor(controller: CommentsController | undefined, author: MsfeCommandAgentContext["author"], thread?: string | null, resolve = false): CommentPerson {
  const context = controller?.agentContext() ?? "unavailable";
  if (typeof context === "string") throw new Error(refusals[context]);
  if (thread !== undefined) {
    const found = controller!.threads().find(view => view.thread.id === thread)?.thread;
    if (found === undefined) throw new Error(refusals["not-found"]);
    if (resolve && !context.canResolve(found)) throw new Error(refusals["not-permitted"]);
  }
  return { id: author?.id ?? "ai", name: author?.name ?? "AI", agent: true };
}

/**
 * Comment commands the AI core may run: add, reply, resolve and reopen, each written as the AI
 * on behalf of the signed-in user and within the host's comment permissions. Editing or deleting
 * messages is not offered.
 * @param controller - Current comment controller.
 * @returns Command factories for `addCommands`.
 */
export function createAgentCommentCommands(controller: () => CommentsController | undefined) {
  /** @param state - Draft state. @param id - Thread. @returns The thread in the draft. */
  const threadIn = (state: CommandProps["state"], id: string | undefined): CommentThread | undefined => id === undefined ? undefined : commentsState.read(state).threads.get(id);
  /** @param thread - Thread. @param resolved - Target state. @param author - AI author. @returns Command writing the decision. */
  const decide = (thread: string | undefined, resolved: boolean, author: CommentPerson) => ({ state, tr }: CommandProps) => {
    const current = threadIn(state, thread);
    const context = controller()?.agentContext();
    if (current === undefined || context === undefined || typeof context === "string" || current.resolved === resolved) return false;
    const { resolvedBy: _by, resolvedAt: _at, ...open } = current;
    const next = resolved ? { ...open, resolved, resolvedBy: author, resolvedAt: context.now() } : { ...open, resolved };
    return tr.effect(commentsEffect, { type: "update", kind: resolved ? "resolve" : "reopen", thread: next });
  };
  return {
    addComment: defineCommand({
      description: "Adds a comment on exact text of a block, or on the whole block, written as the AI.",
      target: "text", category: "comments", params: bodyParams,
      adapt: (params, context) => ({ author: agentAuthor(controller(), context.author), body: (params as { body: string }).body }),
      run: (input: AgentCommentInput) => ({ state, tr }: CommandProps) => {
        const context = controller()?.agentContext();
        if (context === undefined || typeof context === "string" || !input.body?.trim()) return false;
        const source = state.doc.toString(), { from, to } = state.selection.main;
        const thread: CommentThread = {
          id: context.id(), anchor: createCommentAnchor(source, { from, to }, hashCommentSource(source)), resolved: false,
          messages: [{ id: context.id(), parentId: null, author: input.author, requestedBy: context.requestedBy, createdAt: context.now(), body: input.body }]
        };
        return tr.effect(commentsEffect, { type: "create", thread, placement: { id: thread.id, from, to } });
      }
    }),
    replyComment: defineCommand({
      description: "Replies to a comment thread, written as the AI.",
      target: "annotation", category: "comments", params: bodyParams,
      adapt: (params, context) => ({ author: agentAuthor(controller(), context.author, context.annotation), thread: context.annotation, body: (params as { body: string }).body }),
      run: (input: AgentCommentInput) => ({ state, tr }: CommandProps) => {
        const thread = threadIn(state, input.thread);
        const context = controller()?.agentContext();
        if (thread === undefined || context === undefined || typeof context === "string" || !input.body?.trim()) return false;
        const message = { id: context.id(), parentId: thread.messages[0]!.id, author: input.author, requestedBy: context.requestedBy, createdAt: context.now(), body: input.body };
        return tr.effect(commentsEffect, { type: "update", kind: "reply", thread: { ...thread, messages: [...thread.messages, message] } });
      }
    }),
    resolveComment: defineCommand({
      description: "Marks a comment thread as resolved.",
      target: "annotation", category: "comments",
      adapt: (_params, context) => ({ author: agentAuthor(controller(), context.author, context.annotation, true), thread: context.annotation }),
      satisfied: (_params, context) => controller()?.threads().find(view => view.thread.id === context.annotation)?.thread.resolved === true,
      run: (input: AgentCommentInput) => decide(input.thread, true, input.author)
    }),
    reopenComment: defineCommand({
      description: "Reopens a resolved comment thread.",
      target: "annotation", category: "comments",
      adapt: (_params, context) => ({ author: agentAuthor(controller(), context.author, context.annotation, true), thread: context.annotation }),
      satisfied: (_params, context) => controller()?.threads().find(view => view.thread.id === context.annotation)?.thread.resolved === false,
      run: (input: AgentCommentInput) => decide(input.thread, false, input.author)
    })
  };
}
