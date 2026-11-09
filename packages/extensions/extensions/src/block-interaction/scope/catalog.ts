import type { Node as PMNode } from "@quirekit/pm";
import type { BlockCatalog, BlockFact, BlockInteractionOptions, BlockRangeRef, BlockRef } from "../types";
import { readScopeBlockEntries } from "./entries";

const scopeOrders = new WeakMap<BlockCatalog, ReadonlyMap<string, ReadonlyMap<number, BlockFact>>>();

/** @param catalog - Immutable document facts. @returns Sibling indexes reused by selection-only transactions. */
function readScopeOrders(catalog: BlockCatalog): ReadonlyMap<string, ReadonlyMap<number, BlockFact>> {
  const cached = scopeOrders.get(catalog);
  if (cached) return cached;
  const scopes = new Map<string, Map<number, BlockFact>>();
  for (const block of catalog.blocks) {
    let scope = scopes.get(block.scopeId);
    if (!scope) { scope = new Map(); scopes.set(block.scopeId, scope); }
    scope.set(block.order, block);
  }
  scopeOrders.set(catalog, scopes);
  return scopes;
}

/**
 * Describes a document's blocks. The facts are collected on first use, so a
 * document change only records the document: typing and the collaboration
 * server never walk every block, while block handles, menus and commands read
 * the same facts they did.
 * @param doc - Current document.
 * @param options - Explicit schema owners.
 * @param rootId - Loaded document epoch.
 * @param revision - Current document revision.
 * @returns Identity catalog with ambiguous identities removed.
 */
export function createBlockCatalog(doc: PMNode, options: BlockInteractionOptions, rootId: string, revision: number): BlockCatalog {
  let facts: Pick<BlockCatalog, "blocks" | "byId" | "byFrom"> | undefined;
  const read = () => facts ??= collectBlockFacts(doc, options, rootId);
  return { rootId, revision, doc, get blocks() { return read().blocks; }, get byId() { return read().byId; }, get byFrom() { return read().byFrom; } };
}

/**
 * Indexes direct children of each explicitly declared scope.
 * @param doc - Document.
 * @param options - Explicit schema owners.
 * @param rootId - Loaded document epoch.
 * @returns Blocks in order and their unique lookups.
 */
function collectBlockFacts(doc: PMNode, options: BlockInteractionOptions, rootId: string): Pick<BlockCatalog, "blocks" | "byId" | "byFrom"> {
  const blocks: BlockFact[] = [];
  const byId = new Map<string, BlockFact>();
  const duplicates = new Set<string>();
  /** @param parent - Potential scope. @param start - Content start. */
  const visit = (parent: PMNode, start: number): void => {
    const scopeId = options.scopes.includes(parent.type.name) ? parent === doc ? rootId : parent.attrs.blockId : undefined;
    // The cached child pass supplies both membership and explicit nested scopes.
    // Selection frames reuse it; nesting never introduces a second document walk.
    for (const { node, offset, order, blockId } of readScopeBlockEntries(parent, options)) {
      if (typeof scopeId === "string" && options.types.includes(node.type.name)) {
        const fact: BlockFact = { rootId, scopeId, blockId, node, order, scopeFrom: start, from: start + offset, to: start + offset + node.nodeSize };
        blocks.push(fact);
        if (byId.has(blockId)) duplicates.add(blockId);
        byId.set(blockId, fact);
      }
      // Every boundary must opt in. Tables and arbitrary descendants remain closed.
      if (options.scopes.includes(node.type.name)) visit(node, start + offset + 1);
    }
  };
  visit(doc, 0);
  for (const id of duplicates) byId.delete(id);
  return { blocks, byId, byFrom: new Map(blocks.filter(block => byId.has(block.blockId)).map(block => [block.from, block])) };
}

/** @param catalog - Current catalog. @param ref - Captured identity. @returns Current fact or null. */
export function resolveBlockRef(catalog: BlockCatalog, ref: BlockRef): BlockFact | null {
  const fact = catalog.byId.get(ref.blockId);
  return fact?.rootId === ref.rootId && fact.scopeId === ref.scopeId ? fact : null;
}

/** @param catalog - Current catalog. @param range - Captured endpoints. @returns Complete continuous source or null. */
export function resolveBlockRange(catalog: BlockCatalog, range: BlockRangeRef): readonly BlockFact[] | null {
  if (range.expectedDocumentRevision !== catalog.revision) return null;
  const anchor = resolveBlockRef(catalog, range.anchor);
  const focus = resolveBlockRef(catalog, range.focus);
  if (!anchor || !focus || anchor.scopeId !== focus.scopeId) return null;
  const low = Math.min(anchor.order, focus.order);
  const high = Math.max(anchor.order, focus.order);
  const scope = readScopeOrders(catalog).get(anchor.scopeId);
  const result: BlockFact[] = [];
  for (let order = low; order <= high; order++) {
    const block = scope?.get(order);
    if (!block) return null;
    result.push(block);
  }
  return result;
}
