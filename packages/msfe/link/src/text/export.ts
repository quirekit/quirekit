import type { EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree, syntaxTree } from "@quirekit/cm-language";
import { encodeMarkdownDestination, isSafeDestination } from "@quirekit/msfe-core";
import { scanTextLinks, type TextLinkMatch } from "./scan";
import { textLinkRules } from "./rules";
import { exportedDestinations, linkExportHrefs, type ExportEdit } from "../destinations";

const verifyBatch = 100;
const parseBudget = 2000;

/**
 * Serializes the document for export: writes matches of rules with `exportLinks` as Markdown links and rewrites
 * link destinations through `link({ exportHref })`. Candidates the presentation has not verified yet are checked
 * here in batches; a failed check leaves them plain.
 * @param state - Snapshot to export.
 * @param signal - Export lifetime.
 * @returns Markdown; identical to the source when no rule opts in.
 */
export async function linkifyTextLinks(state: EditorState, signal?: AbortSignal): Promise<string> {
  const source = state.doc.toString();
  const rules = state.facet(textLinkRules).filter(rule => rule.options.exportLinks);
  if (!rules.length && !state.facet(linkExportHrefs).length) return source;
  // Export reads the whole document, so it needs a complete parse rather than the viewport's.
  const tree = ensureSyntaxTree(state, state.doc.length, parseBudget) ?? syntaxTree(state);

  // Phase 1: collect non-overlapping candidates; earlier rules win shared ranges.
  const taken: (TextLinkMatch & { readonly rule: (typeof rules)[number] })[] = [];
  for (const rule of rules) {
    for (const match of scanTextLinks(source, 0, rule.pattern, tree)) {
      if (!taken.some(other => match.from < other.to && other.from < match.to)) taken.push({ ...match, rule });
    }
  }

  // Phase 2: verify unknown candidates per rule, reusing results the presentation already has.
  for (const rule of rules) {
    const verify = rule.options.verify;
    if (!verify) continue;
    const unknown = [...new Set(taken.filter(match => match.rule === rule && !rule.known.has(match.text)).map(match => match.text))];
    for (let start = 0; start < unknown.length; start += verifyBatch) {
      signal?.throwIfAborted();
      const batch = unknown.slice(start, start + verifyBatch);
      try {
        const found = new Set(await verify(batch, signal ?? new AbortController().signal));
        for (const text of batch) rule.known.set(text, found.has(text));
      } catch (error) { if (signal?.aborted) throw error; }
    }
  }

  // Phase 3: collect text link and destination edits; text links never fall inside existing links.
  const edits: ExportEdit[] = exportedDestinations(state, tree);
  for (const match of taken) {
    if (match.rule.options.verify && match.rule.known.get(match.text) !== true) continue;
    const url = match.rule.options.href(match.text);
    if (!url || !isSafeDestination(url)) continue;
    edits.push({ from: match.from, to: match.to, insert: `[${match.text}](${encodeMarkdownDestination(url)})` });
  }

  // Phase 4: apply from the end so earlier offsets stay valid.
  let output = source;
  for (const edit of edits.sort((left, right) => right.from - left.from)) output = `${output.slice(0, edit.from)}${edit.insert}${output.slice(edit.to)}`;
  return output;
}
