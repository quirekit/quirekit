import type { QuireAiBlockItem } from "@quirekit/ai-contract";

/** Query inside one known block, separate from a document text search. */
export interface QuireAiItemQuery {
  /** Stable block identity from a prior read. */ readonly block: string;
  /** Offset after filtering, default zero. */ readonly offset?: number | undefined;
  /** Item count bound, default 40 and at most 100. */ readonly limit?: number | undefined;
  /** Exact native IDs to include. */ readonly ids?: readonly string[] | undefined;
  /** Case-sensitive text contained in the full label. */ readonly find?: string | undefined;
}

/** Bounded internal-item page; ordinary document block identities stay unchanged. */
export interface QuireAiItemPage {
  /** Owning block identity. */ readonly block: string;
  /** Filtered-list offset. */ readonly offset: number;
  /** Matching item count before paging. */ readonly total: number;
  /** Next offset, omitted on the last page. */ readonly next?: number | undefined;
  /** Rendered facts, with explicit truncation for oversized values. */ readonly entries: readonly (QuireAiBlockItem & { readonly truncated?: boolean })[];
}
