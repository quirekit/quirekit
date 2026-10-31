import type { MdCommentsPlugin } from "@quirekit/md-editor/vue";
import { mdCommentExtensions } from "./extension";
import { mdCommentsMessages } from "./messages";
import type { MdCommentsOptions } from "./types";
import { createMdCommentsWorkspace } from "./view/workspace";

/**
 * Creates the comment workspace for `MdEditor`'s `comments` prop: stand-off threads, the side rail, the list,
 * document comments and, when configured, CriticMarkup file actions. Storage and permissions stay with the host.
 * @param options - Host user, permissions, change sink and presentation choices.
 * @returns Plugin for `MdEditorProps.comments`.
 */
export function mdComments(options: MdCommentsOptions): MdCommentsPlugin {
  return {
    extensions: context => mdCommentExtensions(options, mdCommentsMessages[context.locale].comments, context.openDraft),
    setup: input => createMdCommentsWorkspace(options, input),
  };
}
