import type { Node } from "@quirekit/pm";
import type { QuireAiBlockItem } from "@quirekit/ai-contract";
import type { QuireAiManager, QuireAiRegistry } from "../../types";
import type { QuireAiDocumentView } from "../types";
import type { QuireAiItemQuery, QuireAiItemPage } from "./types";

/** @param text - Core-owned actionable read failure. @returns Empty result without a different target fallback. */
export function failedQuireAiItemRead(text: string): QuireAiDocumentView { return { text, listed: 0, total: 0, blocks: [] }; }

/** @param item - Feature data. @returns A bounded row, explicitly marking any lost detail. */
function bound(item: QuireAiBlockItem): QuireAiBlockItem & { readonly truncated?: boolean } {
  if (!item.id || item.id.length > 200) throw new Error("Internal item ID must contain 1–200 characters.");
  let truncated = (item.label?.length ?? 0) > 1200 || Object.keys(item.properties ?? {}).length > 24;
  const properties = Object.fromEntries(Object.entries(item.properties ?? {}).slice(0, 24).map(([key, value]) => [key.slice(0, 80), typeof value === "string" ? value.slice(0, 300) : value]));
  truncated ||= Object.entries(item.properties ?? {}).some(([key, value]) => key.length > 80 || typeof value === "string" && value.length > 300);
  const result = { id: item.id, ...(item.label === undefined ? {} : { label: item.label.slice(0, 1200) }), properties };
  return truncated ? { ...result, truncated: true } : result;
}

/**
 * Reads only an explicitly captured block. Filters precede paging and never mutate selection.
 * @param doc - Current canonical document.
 * @param manager - Central capability and identity owner.
 * @param query - Validated item query.
 * @returns Bounded model view and machine-readable paging facts.
 */
export function readQuireAiItems(doc: Node, manager: QuireAiManager, query: QuireAiItemQuery): QuireAiDocumentView {
  const position = manager.identity.resolve(query.block), node = position === null ? null : doc.nodeAt(position);
  if (!node) return failedQuireAiItemRead(`Block ${query.block} does not exist; read the document again for current block ids.`);
  const blockItems = readQuireAiBlockItems(node, manager.registry);
  if (blockItems === null) return failedQuireAiItemRead(`Block ${query.block} has no internal item reader.`);
  const ids = query.ids === undefined ? null : new Set(query.ids);
  const items = blockItems.filter(item => (ids === null || ids.has(item.id)) && (query.find === undefined || (item.label ?? "").includes(query.find)));
  const offset = query.offset ?? 0, limit = query.limit ?? 40, entries: (QuireAiBlockItem & { readonly truncated?: boolean })[] = [];
  let length = 0;
  // The page budget is enforced on rendered rows, retaining a continuation for every unlisted item.
  for (const item of items.slice(offset, offset + limit)) {
    const entry = bound(item), size = JSON.stringify(entry).length + 1;
    if (length + size > 23_000) break;
    entries.push(entry); length += size;
  }
  const next = offset + entries.length < items.length ? offset + entries.length : undefined;
  const page: QuireAiItemPage = { block: query.block, offset, total: items.length, entries, ...(next === undefined ? {} : { next }) };
  const continuation = next === undefined ? "" : `; continue with items {"offset":${next}}, keeping the same block and filters`;
  const text = `[${query.block}] internal items\n${entries.map(entry => JSON.stringify(entry)).join("\n")}\n(${entries.length} of ${items.length} matching items${continuation})`;
  return { text, listed: 1, total: 1, blocks: [{ id: query.block, pos: position!, size: node.nodeSize }], items: page };
}

/**
 * Reads a block's internal items: its own, or for a text block those of the inline objects it holds.
 * @param node - Listed block.
 * @param registry - Compiled facts.
 * @returns Items in source order, or null when neither the block nor its inline objects have any.
 */
export function readQuireAiBlockItems(node: Node, registry: QuireAiRegistry): readonly QuireAiBlockItem[] | null {
  const own = registry.blocks.get(node.type.name)?.items;
  if (own !== undefined) return own(node);
  if (!node.isTextblock) return null;
  const items: QuireAiBlockItem[] = [];
  let found = false;
  node.forEach(child => {
    const owned = registry.blocks.get(child.type.name)?.items?.(child);
    if (owned !== undefined && owned.length > 0) {
      found = true;
      items.push(...owned);
    }
  });
  return found ? items : null;
}
