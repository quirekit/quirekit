import type {} from "@quirekit/collab-contract";
import { Extension, type QuireAnyExtension, type QuireJSONContent } from "@quirekit/core";
import { createWordTableCollabRules, createWordTableJSON } from "@quirekit/classic-table-model";
import { BlockTableNode, BlockTableRowNode, BlockTableCellNode } from "./html/nodes";
import { WordTableLayoutProfile } from "@quirekit/classic-table-model";
import type { BlockTableFeature, BlockTableSize, BlockTableInsertOptions } from "@quirekit/block-editor";
import { blockTableMenu } from "./ui/block-menu";
import { exportBlockTableHTML } from "./styles/serialize";
import { createBlockTableStylePastePlugin } from "./styles/paste";

/** Optional table bridge; canonical semantics and commands remain owned by Classic Table. */
const BlockTable = Extension.create<Record<string, never>, BlockTableFeature>({
  name: "blockTable",
  priority: 110,
  /** @returns Shared Word table rules. */
  addCollabRules() { return createWordTableCollabRules(); },
  /** @returns Built-in definition preparation before canonical paste validation. */
  addProseMirrorPlugins() { return [createBlockTableStylePastePlugin()]; },
  /** @returns Whole-table actions shared by any contextual block-menu consumer. */
  addBlockMenuProviders() { return [blockTableMenu]; },
  /** @returns Schema-neutral creation facts for the Block insertion surface. */
  addStorage() { return { nodeName: "wordTable", exportHTML: exportBlockTableHTML,
    /** @param size - Complete dimensions. @returns Canonical table content when valid. */
    createContent: createBlockTableContent
  }; },
  /** @returns Typed adapter to the shared canonical command, without a second transaction. */
  addCommands() { return {
    /** @param size - Complete dimensions. @returns Canonical insertion command. */
    insertBlockTable: (size: BlockTableInsertOptions) => ({ editor, commands }) => editor.isEditable && commands.insertWordTable(size)
  }; }
});

/** @returns Fresh table schema, table-only layout and optional product integration extensions. */
export function createBlockTableExtensions(): readonly QuireAnyExtension[] {
  return [BlockTableNode, BlockTableRowNode, BlockTableCellNode, WordTableLayoutProfile, BlockTable].map(extension => extension.configure({}));
}

/** @param size - Complete requested dimensions. @returns Fresh canonical table JSON, or null for an invalid tuple. */
export function createBlockTableContent(size: BlockTableSize): QuireJSONContent | null {
  const result = createWordTableJSON(size);
  return result.ok ? result.value : null;
}
