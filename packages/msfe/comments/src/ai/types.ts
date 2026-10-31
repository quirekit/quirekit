import type {} from "@quirekit/msfe-core";
import type { AgentCommentInput } from "./commands";

/** Comment commands the AI core runs; the sidebar writes through the comment controller instead. */
declare module "@quirekit/msfe-core" {
  interface Commands<ReturnType> {
    /** AI comment commands. */
    comments: {
      /** @param input - AI author and body. @returns The caller's result or pending chain. */
      addComment(input: AgentCommentInput): ReturnType;
      /** @param input - AI author, thread and body. @returns The caller's result or pending chain. */
      replyComment(input: AgentCommentInput): ReturnType;
      /** @param input - AI author and thread. @returns The caller's result or pending chain. */
      resolveComment(input: AgentCommentInput): ReturnType;
      /** @param input - AI author and thread. @returns The caller's result or pending chain. */
      reopenComment(input: AgentCommentInput): ReturnType;
    };
  }
}
