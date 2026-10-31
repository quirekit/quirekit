import type { Node } from "@quirekit/pm";
import { QuireDocumentSdkError } from "../../document-sdk/error";
import type { QuireAiBlockIdentity, QuireAiRegistry } from "../types";
import { collectQuireAiBlocks, collectQuireAiSections } from "../view/collect";
import { encodeQuireAiSegment } from "./encode";
import type { QuireAiSegment, QuireAiTransformFilter, QuireAiTransformPlacement } from "./types";

/** Text that is only a web address or an e-mail address. */
const addressOnly = /^\s*(?:https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@]+\.[^\s@]+)\s*$/iu;

/** Blocks a transform covers, and blocks in scope it leaves alone with the reason. */
export interface QuireAiTransformSelection {
  /** Segments to transform, in document order. */
  readonly segments: readonly QuireAiSegment[];
  /** Text blocks in scope that cannot be transformed, with the reason. */
  readonly skipped: readonly { readonly block: string; readonly reason: string }[];
  /** Plain text of every covered or skipped block, for naming it in reports. */
  readonly texts: ReadonlyMap<string, string>;
}

/**
 * Chooses the blocks a transform works on.
 *
 * Every text block in scope with letters in it is covered: body paragraphs,
 * headings, list items, table cells and story blocks. Blocks without letters
 * (empty, symbols, numbers) and blocks that are only an address are left as they
 * are. A replacement cannot rewrite a block holding embedded objects without
 * losing them, so those are reported as skipped.
 *
 * @param doc - Document before the transform.
 * @param registry - Compiled facts.
 * @param identity - Block identities.
 * @param placement - Where results go.
 * @param range - Document range in scope; the whole document when omitted.
 * @param filter - Blocks to limit the run to or keep out of it.
 * @returns Segments, skipped blocks and block texts.
 */
export function selectQuireAiTransformBlocks(
  doc: Node,
  registry: QuireAiRegistry,
  identity: QuireAiBlockIdentity,
  placement: QuireAiTransformPlacement,
  range?: { readonly from: number; readonly to: number },
  filter: QuireAiTransformFilter = {}
): QuireAiTransformSelection {
  const blocks = collectQuireAiSections(doc, registry).flatMap(section => collectQuireAiBlocks(section, registry));
  const ids = identity.assign(blocks.map(block => ({ pos: block.pos, type: block.node.type.name, size: block.node.nodeSize })));
  // Listed blocks become document ranges, so a table's id covers its cells.
  const spans = (list: readonly string[]) => list.map(id => {
    const index = ids.indexOf(id);
    if (index < 0) throw new QuireDocumentSdkError("invalid-input", `Block ${id} does not exist; read the document again for current block ids.`);
    return { from: blocks[index]!.pos, to: blocks[index]!.pos + blocks[index]!.node.nodeSize };
  });
  const only = filter.blocks === undefined ? undefined : spans(filter.blocks);
  const excluded = spans(filter.exclude ?? []);
  const inside = (pos: number, list: readonly { from: number; to: number }[]) => list.some(span => pos >= span.from && pos < span.to);
  const segments: QuireAiSegment[] = [];
  const skipped: { block: string; reason: string }[] = [];
  const texts = new Map<string, string>();
  blocks.forEach(({ node, pos }, index) => {
    if (!node.isTextblock) return;
    if (range !== undefined && (pos + node.nodeSize <= range.from || pos >= range.to)) return;
    if ((only !== undefined && !inside(pos, only)) || inside(pos, excluded)) return;
    const text = node.textContent;
    if (!/\p{L}/u.test(text) || addressOnly.test(text)) return;
    texts.set(ids[index]!, text);
    const segment = encodeQuireAiSegment(node, ids[index]!, segments.length + 1, registry, doc);
    if (placement === "replace" && segment.objects > 0) {
      skipped.push({ block: ids[index]!, reason: "it holds embedded fields or objects that a rewrite would remove" });
      return;
    }
    segments.push(segment);
  });
  return { segments, skipped, texts };
}
