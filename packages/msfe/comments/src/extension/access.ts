import type { MsfeEditor } from "@quirekit/msfe-core";
import type { CommentsController } from "../controller/controller";
import type { CommentsStorage } from "./types";

/** @param editor - Mounted editor. @returns Its comment controller, or null when Comments is not installed. */
export function getComments(editor: MsfeEditor): CommentsController | null {
  return (editor.storage.comments as CommentsStorage | undefined)?.controller ?? null;
}
