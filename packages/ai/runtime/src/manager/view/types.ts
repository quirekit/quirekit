import type { QuireAiLayoutPage } from "@quirekit/ai-contract";
import type { Node } from "@quirekit/pm";

/** One view section: the body or an independent story. */
export interface QuireAiViewSection {
  /** Heading shown for the section. */
  readonly title: string;
  /** Whether the section is a story rather than the body. */
  readonly story: boolean;
  /** Container whose children are the section's blocks. */
  readonly container: Node;
  /** Document position of the container's content start. */
  readonly contentStart: number;
}

/** One block listed in the view. */
export interface QuireAiViewBlock {
  /** Section the block belongs to. */
  readonly section: QuireAiViewSection;
  /** Block node. */
  readonly node: Node;
  /** Position before the block node. */
  readonly pos: number;
  /** Nesting depth below the section, for container children such as table cells. */
  readonly depth: number;
  /** Caption of the enclosing container child, shown on its first block. */
  readonly caption?: string | undefined;
}

/** Paging and scope of one document read. */
export interface QuireAiViewOptions {
  /** Block id the listing starts at; omitted starts at the beginning. */
  readonly from?: string | undefined;
  /** Document position the listing is opened around, a few blocks before the block that holds it; used when `from` is omitted. */
  readonly around?: number | undefined;
  /** Maximum number of blocks listed. */
  readonly limit: number;
  /** Whether story sections such as headers and footers are listed. */
  readonly stories: boolean;
  /** Normalized text a listed block must contain; every block when omitted. */
  readonly find?: string | undefined;
  /** Laid-out pages, shown as page break lines; omitted without a layout. */
  readonly pages?: readonly QuireAiLayoutPage[] | undefined;
}

/** Rendered document view. */
export interface QuireAiDocumentView {
  /** Optional internal item page for one explicitly requested block. */
  readonly items?: import("./items/types").QuireAiItemPage | undefined;
  /** Model-facing view text. */
  readonly text: string;
  /** Number of blocks listed. */
  readonly listed: number;
  /** Total number of blocks in the listed scope. */
  readonly total: number;
  /** Block id to pass as `from` to continue, when the listing was truncated. */
  readonly next?: string | undefined;
  /** Occurrences of the searched text in the whole scope, when the read searched. */
  readonly occurrences?: number | undefined;
  /** Blocks of the scope listed only because an object of theirs mentions the searched text. */
  readonly inObjects?: number | undefined;
  /** Listed blocks in view order. */
  readonly blocks: readonly QuireAiListedBlock[];
}

/** One listed block with its identity. */
export interface QuireAiListedBlock {
  /** Model-visible id. */
  readonly id: string;
  /** Position before the block. */
  readonly pos: number;
  /** Node size. */
  readonly size: number;
}

/** One block flattened for comparison. */
export interface QuireAiChangeBlock {
  /** Story title, or undefined in the body. */
  readonly section: string | undefined;
  /** View line with its section, equal exactly when nothing people can see changed. */
  readonly key: string;
  /** Plain text, one item per character; inline objects appear as their `[label]`. */
  readonly chars: readonly string[];
  /** Character format values per character. */
  readonly charFormats: readonly ReadonlyMap<string, unknown>[];
  /** Paragraph format values. */
  readonly paragraphFormats: ReadonlyMap<string, unknown>;
  /** Block content range: inside a text block, around any other block. */
  readonly range: { readonly from: number; readonly to: number };
  /** Objects with an image, in order: inline ones of a text block, or the block itself. */
  readonly objects: readonly QuireAiChangeObject[];
}

/** One object with an image, as a review compares it. */
export interface QuireAiChangeObject {
  /** View label, equal exactly when nothing the model reads changed. */
  readonly key: string;
  /** People-facing name. */
  readonly label: string;
  /** Image showing the object. */
  readonly image: import("@quirekit/ai-contract").QuireAiPresentedImage;
}
