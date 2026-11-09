import { inheritQuireAppendedHistory, readQuireTransactionOrigin, type QuireEditor } from "@quirekit/core";
import { Plugin, PluginKey } from "@quirekit/pm";
import { v4 as uuidv4 } from "uuid";
import type { BlockCatalog, BlockInteractionOptions } from "../types";
import { createBlockCatalog } from "../scope";
import { normalizeBlockIdentities, stripBlockIdentities } from "./normalize";

/** Per-editor identity/catalog authority. */
export const blockCatalogKey = new PluginKey<BlockCatalog>("quireBlockCatalog");

/** @returns Opaque UUID independent of document position, content or a secure browser context. */
export function createBlockId(): string { return uuidv4(); }

/** @param editor - Editor to inspect. @returns Current catalog, or undefined without the feature. */
export function readBlockCatalog(editor: QuireEditor): BlockCatalog | undefined { return blockCatalogKey.getState(editor.state.pm); }

/** @param editor - Editing authority. @param options - Declared identity owners. @returns Catalog and normalization plugin. */
export function createBlockIdentityPlugin(editor: QuireEditor, options: BlockInteractionOptions): Plugin<BlockCatalog> {
  return new Plugin<BlockCatalog>({
    key: blockCatalogKey,
    state: {
      init: (_, state) => createBlockCatalog(state.doc, options, createBlockId(), 0),
      apply: (tr, previous) => tr.docChanged
        ? createBlockCatalog(tr.doc, options, tr.getMeta("quireViewUpdateReason") === "document-replace" ? createBlockId() : previous.rootId, previous.revision + 1)
        : previous
    },
    props: { transformPasted: stripBlockIdentities, transformCopied: stripBlockIdentities },
    appendTransaction(transactions, oldState, state) {
      if (!editor.isEditable || !transactions.some(tr => tr.docChanged)) return null;
      // Identities are random, so peers must not allocate them for changes they all receive; the server repairs repeats.
      if (transactions.some(tr => readQuireTransactionOrigin(tr) === "collaboration")) return null;
      const tr = state.tr;
      return normalizeBlockIdentities(tr, options, oldState.doc, transactions) ? inheritQuireAppendedHistory(transactions, tr) : null;
    }
  });
}
