import { Facet, type EditorState } from "@quirekit/cm-state";
import type { syntaxTree } from "@quirekit/cm-language";
import { decodeMarkdownDestination, encodeMarkdownDestination, isSafeDestination, readSourceDestination, sourceDocument, sourceNode } from "@quirekit/msfe-core";

/** One source replacement produced for export. */
export interface ExportEdit {
  /** Source start. */ readonly from: number;
  /** Source end. */ readonly to: number;
  /** Replacement Markdown. */ readonly insert: string;
}

/** Export rewrites installed by `link({ exportHref })`; the first non-null result wins. */
export const linkExportHrefs = Facet.define<(url: string) => string | null>();

/**
 * Rewrites inline link and reference definition destinations for export. Images and autolinks are untouched.
 * @param state - Snapshot to export.
 * @param tree - Complete syntax tree of the snapshot.
 * @returns Replacements of destination tokens, empty when no rewrite is installed.
 */
export function exportedDestinations(state: EditorState, tree: ReturnType<typeof syntaxTree>): ExportEdit[] {
  const rewrites = state.facet(linkExportHrefs);
  if (!rewrites.length) return [];
  const document = sourceDocument(state), edits: ExportEdit[] = [];
  /** @param from - Token start. @param to - Token end. @param url - Decoded destination. */
  const rewrite = (from: number, to: number, url: string) => {
    let next: string | null = null;
    for (const href of rewrites) if ((next = href(url)) !== null) break;
    if (next && next !== url && isSafeDestination(next)) edits.push({ from, to, insert: encodeMarkdownDestination(next) });
  };
  tree.iterate({ enter: (node) => {
    if (node.name === "Link") {
      const destination = readSourceDestination(document, sourceNode(node.node));
      if (destination?.kind === "inline" && destination.urlFrom < destination.urlTo) {
        const shift = destination.angled ? 1 : 0;
        rewrite(destination.urlFrom - shift, destination.urlTo + shift, destination.url);
      }
    } else if (node.name === "LinkReference") {
      const token = node.node.getChild("URL");
      if (!token) return;
      const raw = state.sliceDoc(token.from, token.to);
      rewrite(token.from, token.to, decodeMarkdownDestination(raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw));
    }
  } });
  return edits;
}
