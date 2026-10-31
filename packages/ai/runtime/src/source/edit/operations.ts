import type { QuireAiSourceDocument } from "../types";
import type { QuireAiSourceSnapshot, QuireAiSourceViewBlock } from "../view/types";
import { QuireAiSourceOperationFailure, type QuireAiSourceDraft } from "./draft";
import { insertQuireAiSourceBlocks, removeQuireAiSourceBlocks, type QuireAiSourceAnchor } from "./placement";
import { findQuireAiSourceText, indentQuireAiMarkdown, normalizeQuireAiMarkdown } from "./text";

/** Facts every core operation is planned with. */
export interface QuireAiSourceOperationScope {
  /** Draft to change. */
  readonly draft: QuireAiSourceDraft;
  /** Snapshot the model read. */
  readonly snapshot: QuireAiSourceSnapshot;
  /** Source document port. */
  readonly document: QuireAiSourceDocument;
}

/** A core operation as the schema admits it. */
export type QuireAiSourceCoreOperation = Readonly<Record<string, unknown>> & { readonly op: string };

/**
 * @param snapshot - Snapshot.
 * @param id - Block id.
 * @returns The block.
 * @throws QuireAiSourceOperationFailure for an unknown id.
 */
export function requireQuireAiSourceBlock(snapshot: QuireAiSourceSnapshot, id: unknown): QuireAiSourceViewBlock {
  const block = snapshot.blocks.find(item => item.id === id);
  if (block === undefined) throw new QuireAiSourceOperationFailure("stale-target", `block ${String(id)} does not exist; read the document again for current ids.`);
  return block;
}

/** @param block - Block. @throws QuireAiSourceOperationFailure when a fact summarizes it. */
function requireText(block: QuireAiSourceViewBlock): void {
  if (block.summary === undefined) return;
  const command = block.summary.command === undefined ? "the commands listed for it" : `the ${block.summary.command} command`;
  throw new QuireAiSourceOperationFailure("invalid-input", `${block.id} (${block.summary.label}) holds data, not text; change it with ${command}.`);
}

/**
 * Plans one core operation on the draft.
 * @param scope - Draft, snapshot and port.
 * @param operation - Operation.
 * @returns Occurrences replaced, for replace_all; otherwise 1.
 */
export function planQuireAiSourceCoreOperation(scope: QuireAiSourceOperationScope, operation: QuireAiSourceCoreOperation): number {
  const { draft, snapshot, document } = scope;
  const block = () => requireQuireAiSourceBlock(snapshot, operation.block);
  switch (operation.op) {
    case "replace": {
      const target = block();
      requireText(target);
      const text = normalizeQuireAiMarkdown(String(operation.text));
      if (text === "") throw new QuireAiSourceOperationFailure("invalid-input", "the new text is empty; use delete to remove a block.");
      if (target.kind === "list-item" && !document.segment(text).filter(item => item.depth === 0).every(item => item.kind === "list-item")) {
        throw new QuireAiSourceOperationFailure("invalid-input", `${target.id} is a list item: write list items, each starting with a marker such as "- ", or delete it and insert other blocks next to the list.`);
      }
      const { from, to } = draft.locate(target);
      draft.change([{ from, to, insert: indentQuireAiMarkdown(text, target.indent, false) }]);
      return 1;
    }
    case "append": {
      const target = block();
      requireText(target);
      const { to } = draft.locate(target);
      draft.change([{ from: to, to, insert: indentQuireAiMarkdown(String(operation.text).replace(/\r\n?/gu, "\n"), target.indent, false) }]);
      return 1;
    }
    case "replace_text": {
      const target = block();
      requireText(target);
      const { from, to } = draft.locate(target);
      const find = String(operation.find);
      const found = findQuireAiSourceText(draft.text, from, to, target.indent, find);
      const occurrence = typeof operation.occurrence === "number" ? operation.occurrence : 1;
      const range = found[occurrence - 1];
      if (range === undefined) {
        throw new QuireAiSourceOperationFailure("invalid-input", found.length === 0
          ? `${JSON.stringify(find)} is not in ${target.id}; copy the text exactly from the view.`
          : `${target.id} has ${found.length} occurrence(s) of ${JSON.stringify(find)}, not ${occurrence}.`);
      }
      draft.change([{ ...range, insert: indentQuireAiMarkdown(String(operation.replace), target.indent, false) }]);
      return 1;
    }
    case "replace_all": return replaceAll(scope, operation);
    case "insert": {
      const texts = (operation.blocks as readonly string[]).map(normalizeQuireAiMarkdown).filter(text => text !== "");
      if (texts.length === 0) throw new QuireAiSourceOperationFailure("invalid-input", "the new blocks are empty.");
      insertQuireAiSourceBlocks(draft, snapshot, document, anchorOf(snapshot, operation), texts);
      return 1;
    }
    case "move": {
      const blocks = adjacentBlocks(snapshot, operation.blocks as readonly string[]);
      const anchor = anchorOf(snapshot, operation);
      if (anchor.kind === "after" || anchor.kind === "before") {
        if (blocks.some(item => item.from <= anchor.block.from && anchor.block.from <= item.end)) {
          throw new QuireAiSourceOperationFailure("invalid-input", "the target is one of the moved blocks or inside them.");
        }
      }
      const removed = removeQuireAiSourceBlocks(draft, snapshot, blocks[0]!, blocks.at(-1)!);
      insertQuireAiSourceBlocks(draft, snapshot, document, anchor, [removed]);
      return 1;
    }
    case "delete": {
      const ids = [...new Set(operation.blocks as readonly string[])];
      const targets = ids.map(id => requireQuireAiSourceBlock(snapshot, id)).sort((left, right) => left.from - right.from);
      // A block inside another removed block goes with it.
      const outer = targets.filter(item => !targets.some(other => other !== item && other.from < item.from && item.from <= other.end));
      for (const target of outer) removeQuireAiSourceBlocks(draft, snapshot, target, target);
      return 1;
    }
    default: throw new QuireAiSourceOperationFailure("invalid-input", "unknown operation.");
  }
}

/**
 * @param scope - Draft, snapshot and port.
 * @param operation - replace_all operation.
 * @returns Occurrences replaced.
 */
function replaceAll(scope: QuireAiSourceOperationScope, operation: QuireAiSourceCoreOperation): number {
  const { draft, snapshot } = scope;
  const find = String(operation.find);
  let targets = snapshot.blocks;
  if (operation.blocks !== undefined) {
    const chosen = (operation.blocks as readonly string[]).map(id => requireQuireAiSourceBlock(snapshot, id));
    targets = snapshot.blocks.filter(item => chosen.some(parent => parent.from <= item.from && item.from <= parent.end));
  }
  const changes = targets.filter(item => item.summary === undefined).flatMap(item => {
    const { from, to } = draft.locate(item);
    return findQuireAiSourceText(draft.text, from, to, item.indent, find)
      .map(range => ({ ...range, insert: indentQuireAiMarkdown(String(operation.replace), item.indent, false) }));
  });
  if (changes.length === 0) throw new QuireAiSourceOperationFailure("invalid-input", `${JSON.stringify(find)} does not occur ${operation.blocks === undefined ? "in the document" : "in those blocks"}.`);
  draft.change(changes);
  return changes.length;
}

/**
 * @param snapshot - Snapshot.
 * @param operation - insert or move operation.
 * @returns Its anchor.
 */
function anchorOf(snapshot: QuireAiSourceSnapshot, operation: QuireAiSourceCoreOperation): QuireAiSourceAnchor {
  const given = [operation.after, operation.before, operation.at].filter(value => value !== undefined);
  if (given.length !== 1) throw new QuireAiSourceOperationFailure("invalid-input", "give exactly one of after, before or at.");
  if (operation.at === "start" || operation.at === "end") return { kind: operation.at };
  return { kind: operation.after !== undefined ? "after" : "before", block: requireQuireAiSourceBlock(snapshot, operation.after ?? operation.before) };
}

/**
 * @param snapshot - Snapshot.
 * @param ids - Blocks to move.
 * @returns The blocks in order.
 * @throws QuireAiSourceOperationFailure unless they are adjacent blocks of one level.
 */
function adjacentBlocks(snapshot: QuireAiSourceSnapshot, ids: readonly string[]): QuireAiSourceViewBlock[] {
  const blocks = [...new Set(ids)].map(id => requireQuireAiSourceBlock(snapshot, id)).sort((left, right) => left.from - right.from);
  const head = blocks[0]!;
  const level = head.kind === "list-item"
    ? snapshot.blocks.filter(item => item.kind === "list-item" && item.depth === head.depth && item.list === head.list)
    : snapshot.blocks.filter(item => item.depth === 0);
  const first = level.indexOf(head);
  if (blocks.some((item, index) => level[first + index] !== item)) {
    throw new QuireAiSourceOperationFailure("invalid-input", "move takes adjacent blocks of one level, such as consecutive paragraphs or consecutive items of one list.");
  }
  return blocks;
}
