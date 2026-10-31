import { Extension, type AnyExtension } from "@quirekit/msfe-core";
import { Comments } from "@quirekit/msfe-comments";
import { mdCommentsBridgeExtension } from "./bridge";
import { MdCriticMarkup } from "./critic-markup";
import type { MdCommentsOptions } from "./types";

/**
 * @param options - Host comment configuration.
 * @param label - Accessible name of point markers.
 * @param openDraft - Opens the product draft for the current selection.
 * @returns Comment state, the Mod-Alt-M shortcut, the `MdEditor` bridge and, when configured, CriticMarkup file actions.
 */
export function mdCommentExtensions(options: MdCommentsOptions, label: string, openDraft: () => boolean): readonly AnyExtension[] {
  const { criticMarkup, avatar: _avatar, ...comments } = options;
  return [Comments.configure({ ...comments, markerLabel: label }), Extension.create({ name: "mdCommentShortcut",
    /** @returns Shortcut that opens a comment draft, the same key as common document editors. */
    addKeyboardShortcuts: () => ({ "Mod-Alt-m": openDraft }) }), mdCommentsBridgeExtension(options.user ?? undefined),
  ...(criticMarkup ? [MdCriticMarkup.configure(criticMarkup === true ? {} : criticMarkup)] : [])];
}
