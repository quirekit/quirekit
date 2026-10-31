import { Extension } from "@quirekit/msfe-core";
import { CommentsController } from "../controller/controller";
import type { CommentsOptions } from "../controller/types";
import { createAgentCommentCommands } from "../ai/commands";
import { createCommentsAiFacts } from "../ai/facts";
import { commentsHistory, commentsOperationHistory, commentsState } from "../state/slot";
import { commentsLayer } from "./layer";
import { commentedComponents } from "./components";
import { commentsTheme } from "./theme";
import type { CommentsStorage } from "./types";
import type {} from "../ai/types";

/** Stand-off comments: the Markdown source never changes; threads live in comment state and the exchange format. */
export const Comments = Extension.create<CommentsOptions, CommentsStorage>({
  name: "comments",
  /** @returns Read-only defaults until the host supplies a user. */
  addOptions() { return { user: null }; },
  /** @returns Per-installation controller slot. */
  addStorage() { return {}; },
  /** @returns Document-local comment state. */
  addState() { return [commentsState]; },
  /** @returns Highlight and marker layer. */
  addProjectionLayers() { return [commentsLayer(this.options, () => this.storage.controller)]; },
  /** @returns Undo restoration of edited ranges, fallback colors and outlines for commented components. */
  addCodeMirrorExtensions() { return [commentsHistory, commentsOperationHistory, commentsTheme, commentedComponents]; },
  /** @returns Comment commands the AI core may run, written as the AI within the user's permissions. */
  addCommands() { return createAgentCommentCommands(() => this.storage.controller); },
  /** @returns Comment threads as annotations of source ranges. */
  addAiCapabilities() { return createCommentsAiFacts(() => this.storage.controller); },
  /** @returns Disposer that retires the controller with the editor. */
  onCreate() {
    this.storage.controller = new CommentsController(this.editor, this.options);
    return () => { delete this.storage.controller; };
  },
  /** @param event - Accepted transaction, reported when it carries comment operations. */
  onTransaction(event) { this.storage.controller?.observe(event.transaction); },
});
