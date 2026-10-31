import type { QuireDocumentChange, QuireDocumentTextPiece } from "../../document-sdk/types";
import { diffQuireAiSequences } from "../../manager/view/sequence";
import type { QuireAiSourceBlockCapability } from "@quirekit/ai-contract";
import type { QuireAiSourceDocument } from "../types";
import { stripQuireAiSourceIndent } from "../view/snapshot";

/** Characters of a block quoted to locate it. */
const excerptLength = 40;

/** A block of either text, as the review compares it. */
interface Entry {
  /** Source as the view lists it. */
  readonly text: string;
  /** People-facing name of a block a fact summarizes, such as a diagram; its source is not shown. */
  readonly title?: string | undefined;
  /** Own range in its text. */
  readonly from: number;
  /** End of the own range. */
  readonly to: number;
}

/**
 * Lists the block-level changes between two versions of a source document for people.
 *
 * Blocks are matched by their source; between matched blocks, removed and added blocks are
 * paired in order as edits with their text pieces, and the rest are reported as removed or added.
 *
 * @param document - Source document port, to segment both texts.
 * @param source - Text before.
 * @param candidate - Text after.
 * @returns Changes in document order.
 */
export function describeQuireAiSourceChanges(document: QuireAiSourceDocument, source: string, candidate: string): QuireDocumentChange[] {
  const presenters = document.capabilities().filter((fact): fact is QuireAiSourceBlockCapability => fact.kind === "source-block" && fact.present !== undefined);
  const before = entries(document, source, presenters);
  const after = entries(document, candidate, presenters);
  const steps = diffQuireAiSequences(before, after, (left, right) => left.text === right.text);
  const changes: QuireDocumentChange[] = [];
  let removed: Entry[] = [];
  let inserted: Entry[] = [];
  let lastBefore = 0;
  let lastAfter = 0;
  const flush = () => {
    const paired = Math.min(removed.length, inserted.length);
    for (let index = 0; index < paired; index += 1) changes.push(edited(removed[index]!, inserted[index]!));
    for (const entry of removed.slice(paired)) changes.push({ kind: "removed", excerpt: entry.title ?? excerpt(entry.text), formats: [], source: { from: entry.from, to: entry.to }, candidate: { from: lastAfter, to: lastAfter } });
    for (const entry of inserted.slice(paired)) changes.push({ kind: "inserted", excerpt: entry.title ?? excerpt(entry.text), formats: [], source: { from: lastBefore, to: lastBefore }, candidate: { from: entry.from, to: entry.to } });
    removed = [];
    inserted = [];
  };
  for (const step of steps) {
    if (step.kind === "removed") removed.push(before[step.a]!);
    else if (step.kind === "inserted") inserted.push(after[step.b]!);
    else {
      flush();
      lastBefore = before[step.a]!.to;
      lastAfter = after[step.b]!.to;
    }
  }
  flush();
  return changes;
}

/**
 * @param document - Port.
 * @param text - Text.
 * @param presenters - Facts that summarize blocks.
 * @returns Its blocks as compared.
 */
function entries(document: QuireAiSourceDocument, text: string, presenters: readonly QuireAiSourceBlockCapability[]): Entry[] {
  return document.segment(text).map(block => {
    const source = stripQuireAiSourceIndent(text.slice(block.from, block.to), block.indent);
    let title: string | undefined;
    for (const fact of presenters) {
      if (!fact.names.includes(block.name)) continue;
      const summary = fact.present!({ text: source, name: block.name, attrs: block.attrs });
      if (summary !== undefined) { title = summary.title ?? excerpt(summary.label); break; }
    }
    return { text: source, ...(title === undefined ? {} : { title }), from: block.from, to: block.to };
  });
}

/** @param a - Block before. @param b - Block after. @returns The edit with its text pieces. */
function edited(a: Entry, b: Entry): QuireDocumentChange {
  // A summarized block, such as a diagram, is named rather than compared character by character.
  if (a.title !== undefined || b.title !== undefined) {
    return { kind: "edited", excerpt: b.title ?? a.title!, formats: [], source: { from: a.from, to: a.to }, candidate: { from: b.from, to: b.to } };
  }
  const left = [...a.text];
  const right = [...b.text];
  const pieces: QuireDocumentTextPiece[] = [];
  for (const step of diffQuireAiSequences(left, right)) {
    const kind = step.kind;
    const char = step.kind === "inserted" ? right[step.b]! : left[step.a]!;
    const last = pieces.at(-1);
    if (last !== undefined && last.kind === kind) pieces[pieces.length - 1] = { kind, text: last.text + char };
    else pieces.push({ kind, text: char });
  }
  return { kind: "edited", excerpt: excerpt(a.text), text: pieces, formats: [], source: { from: a.from, to: a.to }, candidate: { from: b.from, to: b.to } };
}

/** @param text - Block source. @returns Its start, on one line. */
function excerpt(text: string): string {
  const single = text.replace(/\s+/gu, " ").trim();
  return single.length > excerptLength ? `${single.slice(0, excerptLength)}…` : single;
}
