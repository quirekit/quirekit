import { Extension, type MsfeEditor } from "@quirekit/msfe-core";
import { getComments, type CommentPerson } from "@quirekit/msfe-comments";
import type { MdCriticMarkupOptions } from "./types";

/** Installed only when the host enables CriticMarkup; the converter itself loads on first use. */
export const MdCriticMarkup = Extension.create<MdCriticMarkupOptions, { options?: MdCriticMarkupOptions }>({
  name: "mdCriticMarkup", requires: ["comments"],
  /** @returns Both directions on, resolved threads and suggestions left alone. */
  addOptions() { return {}; },
  /** @returns Slot for the configured options, read by file actions. */
  addStorage() { return {}; },
  /** @returns Disposer clearing the published options. */
  onCreate() { this.storage.options = this.options; return () => { delete this.storage.options; }; },
});

/**
 * @param editor - Editor.
 * @param direction - File action.
 * @returns Options when CriticMarkup is installed and that direction is on.
 */
export function criticMarkupFor(editor: MsfeEditor, direction: "export" | "import"): MdCriticMarkupOptions | null {
  const options = (editor.storage.mdCriticMarkup as { options?: MdCriticMarkupOptions } | undefined)?.options;
  return options && options[direction] !== false && getComments(editor) ? options : null;
}

/**
 * @param editor - Editor with comments.
 * @param markdown - Source snapshot being exported.
 * @returns The snapshot with current comments written as CriticMarkup.
 */
export async function withCriticMarkup(editor: MsfeEditor, markdown: string): Promise<string> {
  const options = criticMarkupFor(editor, "export"), comments = getComments(editor);
  if (!options || !comments) return markdown;
  const { exportCriticMarkup } = await import("@quirekit/msfe-comments/critic-markup");
  return exportCriticMarkup(markdown, comments.exportComments(), { includeResolved: options.includeResolved ?? false }).markdown;
}

/**
 * Splits imported Markdown into clean source and comments; the comments are merged after the source is committed.
 * @param editor - Editor with comments.
 * @param markdown - Imported file text.
 * @param author - Author for unsigned marks.
 * @returns Clean source and a merge step, or null when nothing applies.
 */
export async function readCriticMarkup(editor: MsfeEditor, markdown: string, author: CommentPerson): Promise<{ readonly markdown: string; readonly count: number; merge(): void } | null> {
  const options = criticMarkupFor(editor, "import");
  if (!options || !markdown.includes("{>>")) return null;
  const { importCriticMarkup } = await import("@quirekit/msfe-comments/critic-markup");
  const result = importCriticMarkup(markdown, { author, suggestions: options.suggestions ?? "keep" });
  return { markdown: result.markdown, count: result.comments.threads.length, merge() {
    const comments = getComments(editor);
    if (!comments || !result.comments.threads.length) return;
    // The imported text ends the document both when it replaced it and when it was appended.
    const offset = editor.state.doc.length - result.markdown.length, current = comments.exportComments();
    // Document comments carry no position to shift.
    const added = result.comments.threads.map(thread => thread.anchor ? { ...thread,
      anchor: { ...thread.anchor, hint: { from: thread.anchor.hint.from + offset, to: thread.anchor.hint.to + offset } } } : thread);
    const threads = [...current.threads, ...added];
    comments.importComments({ ...current, version: threads.some(thread => !thread.anchor) ? 2 : 1, threads });
  } };
}
