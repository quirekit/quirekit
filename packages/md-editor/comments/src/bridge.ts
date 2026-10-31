import type { EditorState } from "@quirekit/cm-state";
import { Extension, type MsfeEditor } from "@quirekit/msfe-core";
import { commentsState, getComments, type CommentPerson } from "@quirekit/msfe-comments";
import { mdCommentsStorage, type MdActivityLocation, type MdCommentsBridge, type MdCommentsBridgeStorage } from "@quirekit/md-editor/vue";
import { criticMarkupFor, readCriticMarkup, withCriticMarkup } from "./critic-markup";

/** Author of imported comment marks that carry no signature and no current user. */
const unsignedAuthor: CommentPerson = { id: "criticmarkup", name: "CriticMarkup" };

/**
 * @param state - Current state.
 * @param id - Thread identity.
 * @returns The thread's current range from the installed comments.
 */
export function locateCommentThread(state: EditorState, id: string): MdActivityLocation {
  let comments;
  try { comments = commentsState.read(state); } catch { return { status: "unavailable" }; }
  if (!comments.threads.has(id)) return { status: "deleted" };
  const range = comments.ranges.all().find(item => item.id === id);
  // Orphaned threads lost their anchored text.
  return range ? { status: "exact", range: { from: range.from, to: range.to } } : { status: "deleted" };
}

/**
 * @param editor - Editor with comments.
 * @param user - Current comment user, the author of unsigned imported marks.
 * @returns Comment services for the toolbar, file dialog and activity panel.
 */
export function createMdCommentsBridge(editor: MsfeEditor, user: CommentPerson | undefined): MdCommentsBridge {
  return {
    writable: () => !!getComments(editor)?.writable(),
    locate: locateCommentThread,
    exportsReview: () => !!criticMarkupFor(editor, "export"),
    exportReview: markdown => withCriticMarkup(editor, markdown),
    importsReview: () => !!criticMarkupFor(editor, "import"),
    readReview: markdown => readCriticMarkup(editor, markdown, user ?? unsignedAuthor),
  };
}

/**
 * Publishes the bridge under the storage name `MdEditor` reads.
 * @param user - Current comment user.
 * @returns Bridge extension; it requires the comment state.
 */
export function mdCommentsBridgeExtension(user: CommentPerson | undefined) {
  return Extension.create<Record<string, never>, MdCommentsBridgeStorage>({
    name: mdCommentsStorage, requires: ["comments"],
    /** @returns Slot for the bridge. */
    addStorage() { return {}; },
    /** @returns Disposer clearing the published bridge. */
    onCreate() { this.storage.bridge = createMdCommentsBridge(this.editor, user); return () => { delete this.storage.bridge; }; },
  });
}
