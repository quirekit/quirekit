import type {} from "@quirekit/collab-contract";
import { Extension, type QuireAnyExtension } from "@quirekit/core";
import { WordNumbering, createWordNumberingCollabRules } from "@quirekit/classic-numbering-model";
import type { BlockListFeature } from "@quirekit/block-editor";
import { createListCommands } from "./commands";
import { blockListFacts } from "./facts";
import { createListDecorations } from "./html/plugin";
import { normalizeListContainers, createListMigrationPlugin } from "./migration/plugin";

/** Product adapter; all persistent numbering operations remain in the shared owner. */
const BlockLists = Extension.create<Record<string, never>, BlockListFeature>({
  name: "blockLists",
  /** @returns Schema-neutral facts for Block controls. */
  addStorage() { return blockListFacts; },
  /** @returns Typed delegation without a second numbering algorithm. */
  addCommands() { return createListCommands(); },
  /** @returns Derived HTML presentation and legacy-container admission. */
  addProseMirrorPlugins() { return [createListMigrationPlugin(), createListDecorations(this.editor!)]; },
  /** @returns Shared numbering rules; legacy-list migration acts on the local peer's input. */
  addCollabRules() {
    return [...createWordNumberingCollabRules(), { kind: "server-plugin", key: "blockListMigration", role: "client" }];
  },
  /** @param context - Newly created session with legacy content. */
  onCreate({ editor }) {
    editor.commands.command(({ tr, dispatch }) => {
      if (!normalizeListContainers(tr)) return false;
      dispatch?.(tr.setMeta("addToHistory", false));
      return true;
    });
  }
});

/** @returns Shared Classic numbering with continuous-flow projection; no pagination or product shell. */
export function createBlockNumberingExtensions(): readonly QuireAnyExtension[] {
  // Canonical prefix rules must run before the compatibility wrapper rules.
  return [WordNumbering.extend({ priority: 1100 }).configure({}), BlockLists.configure({})];
}
