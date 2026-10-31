import type { ChainedCommands, CommandProps } from "@quirekit/core";
import { Selection, TextSelection, type Node, type Transaction } from "@quirekit/pm";
import { createQuireAiInlineContent, quireAiLineBreak, replaceQuireAiTextWithLineBreaks } from "./text";
import type { QuireAiEditRange, QuireAiFormatValue, QuireAiPlannedOperation } from "./types";

/**
 * Appends a planned edit to one command chain.
 *
 * Every operation runs as an inline command on the chain's shared transaction.
 * Positions were planned against the start document and are mapped through the
 * transaction when each operation runs, so earlier operations never shift later
 * targets. The original selection is mapped and restored at the end.
 *
 * @param chain - AI-provenance chain, or a capability chain for preflight.
 * @param operations - Planned operations.
 * @param selection - Selection before the edit.
 * @param report - Receives the first failed operation and whether every format was already in place.
 * @returns The chain with the edit appended.
 */
export function appendQuireAiEdit(
  chain: ChainedCommands,
  operations: readonly QuireAiPlannedOperation[],
  selection: QuireAiEditRange,
  report: QuireAiEditReport
): ChainedCommands {
  let next = chain;
  report.alreadySatisfied = operations.every(operation => operation.kind === "format" || (operation.kind === "delete" && operation.ranges.length === 0));
  operations.forEach((operation, index) => {
    next = next.command((props: CommandProps) => {
      const done = runQuireAiOperation(props, operation, report);
      if (!done) report.failed ??= index;
      return done;
    });
  });
  return next.command(({ tr }: CommandProps) => {
    restoreSelection(tr, selection);
    return true;
  });
}

/** Outcome facts collected while an edit runs. */
export interface QuireAiEditReport {
  /** Index of the first operation whose commands failed. */
  failed?: number | undefined;
  /** Whether every operation is a format whose values were already in place. */
  alreadySatisfied: boolean;
  /** Product-configured AI identity handed to actions; absent while previewing. */
  author?: { readonly id: string; readonly name: string } | null | undefined;
}

/**
 * Runs one planned operation on the shared transaction.
 * @param props - Command props of the shared transaction.
 * @param operation - Planned operation.
 * @param report - Outcome facts of the edit.
 * @returns Whether every command of the operation succeeded.
 */
export function runQuireAiOperation(props: CommandProps, operation: QuireAiPlannedOperation, report: QuireAiEditReport): boolean {
  const { tr } = props;
  const map = (pos: number, assoc: -1 | 1) => tr.mapping.map(pos, assoc);
  const schema = tr.doc.type.schema;
  try {
    switch (operation.kind) {
      case "replace-content": {
        // Whole-content ranges widen over edits at their edges so the block is fully replaced.
        const from = map(operation.range.from, -1);
        const to = map(operation.range.to, 1);
        if (operation.text.length > 0) tr.replaceWith(from, to, createQuireAiInlineContent(schema, operation.text));
        else tr.delete(from, to);
        return operation.spans.every(span => applyQuireAiFormat(props, { from: from + span.start, to: from + span.end }, span));
      }
      case "replace-text": {
        const from = map(operation.range.from, 1);
        const to = map(operation.range.to, -1);
        if (to <= from) return false;
        if (operation.text.includes(quireAiLineBreak)) replaceQuireAiTextWithLineBreaks(tr, from, to, operation.text);
        else if (operation.text.length > 0) tr.insertText(operation.text, from, to);
        else tr.delete(from, to);
        return true;
      }
      case "insert": {
        let at = map(operation.at, 1);
        for (const block of operation.blocks) {
          tr.insert(at, block.node);
          const inserted = tr.doc.nodeAt(at);
          if (inserted === null) return false;
          const content = { from: at + 1, to: at + inserted.nodeSize - 1 };
          if (!block.paragraph.every(value => applyQuireAiFormat(props, content, value))) return false;
          if (!block.spans.every(span => applyQuireAiFormat(props, { from: content.from + span.start, to: content.from + span.end }, span))) return false;
          for (const entry of block.nested ?? []) {
            if (!entry.spans.every(span => applyQuireAiFormat(props, { from: at + entry.offset + span.start, to: at + entry.offset + span.end }, span))) return false;
          }
          at += tr.doc.nodeAt(at)?.nodeSize ?? inserted.nodeSize;
        }
        return true;
      }
      case "move": {
        // The original nodes move, so ids, revisions and anchors go with them. Whichever edit lies later
        // in the document runs first, so the other's position stays valid.
        const from = map(operation.from, 1);
        const to = map(operation.to, -1);
        const at = map(operation.at, operation.at <= operation.from ? -1 : 1);
        const content = tr.doc.slice(from, to).content;
        if (at >= to) {
          tr.insert(at, content);
          tr.delete(from, to);
        } else {
          tr.delete(from, to);
          tr.insert(at, content);
        }
        return true;
      }
      case "delete": {
        // Adjacent blocks go as one range, as a selection deletes them: revision tracking records one
        // deletion step reliably, and separate steps per block reorder or lose content when tracked.
        const merged: typeof operation.ranges[number][] = [];
        for (const range of [...operation.ranges].sort((left, right) => left.from - right.from)) {
          const last = merged.at(-1);
          if (last !== undefined && !last.clear && !range.clear && last.to === range.from) merged[merged.length - 1] = { ...last, to: range.to };
          else merged.push(range);
        }
        for (const range of merged.reverse()) {
          if (range.clear) tr.delete(map(range.from + 1, -1), map(range.to - 1, 1));
          else tr.delete(map(range.from, 1), map(range.to, -1));
        }
        return true;
      }
      case "action": {
        const pos = operation.pos === null ? null : map(operation.pos, 1);
        const range = operation.range === null ? null : { from: map(operation.range.from, 1), to: map(operation.range.to, -1) };
        if (range !== null) {
          // An empty block gives an empty range: the action inserts there, such as a picture in an empty cell.
          if (range.to < range.from) return false;
          props.tr.setSelection(TextSelection.between(tr.doc.resolve(range.from), tr.doc.resolve(range.to)));
        } else {
          // Section-scoped actions without a target act where the selection is: the first body section.
          const anchor = pos ?? (operation.defaultAnchor === null ? null : map(operation.defaultAnchor, 1));
          if (anchor !== null) props.tr.setSelection(Selection.near(tr.doc.resolve(Math.min(anchor + 1, tr.doc.content.size))));
        }
        void props.state.tr;
        report.alreadySatisfied = false;
        return operation.action.apply({ tr, commands: props.commands, pos, range, author: report.author ?? null, prepared: operation.prepared, text: operation.text ?? null }, operation.params);
      }
      case "format":
        return operation.targets.every(target => {
          const range = { from: map(target.from, -1), to: map(target.to, 1) };
          if (hasFormatValue(tr.doc, range, target)) return true;
          report.alreadySatisfied = false;
          return applyQuireAiFormat(props, range, target);
        });
    }
  } catch {
    // A structurally invalid step (content the schema does not admit there) fails the operation.
    return false;
  }
}

/**
 * Applies one format value to a mapped range.
 * @param props - Command props of the shared transaction.
 * @param range - Range in the transaction's current document.
 * @param value - Format and value.
 * @returns Whether the owning command accepted the change.
 */
export function applyQuireAiFormat(props: CommandProps, range: QuireAiEditRange, value: QuireAiFormatValue): boolean {
  if (range.to < range.from) return false;
  props.tr.setSelection(TextSelection.between(props.tr.doc.resolve(range.from), props.tr.doc.resolve(range.to)));
  // Chainable state snapshots doc and selection until `tr` is read; refresh it so
  // selection-based commands see the selected range and earlier operations.
  void props.state.tr;
  return value.format.apply!({ tr: props.tr, commands: props.commands, from: range.from, to: range.to }, value.value);
}

/**
 * Checks whether a range already carries a format value, so setting it again is a no-op.
 *
 * Owning commands commonly refuse a change that alters nothing; treating that as
 * failure would reject a whole edit over a value that is already correct.
 *
 * @param doc - Current document.
 * @param range - Range in the current document.
 * @param value - Format and value.
 * @returns Whether every text block (paragraph) or text run (character) in the range has the value.
 */
function hasFormatValue(doc: Node, range: QuireAiEditRange, value: QuireAiFormatValue): boolean {
  const expected = JSON.stringify(value.value ?? null);
  // An object value names only the fields it sets, such as a list kind without a level; the others may differ.
  const fields = value.value !== null && typeof value.value === "object" && !Array.isArray(value.value)
    ? Object.entries(value.value as Record<string, unknown>) : null;
  const matches = (read: unknown) => fields !== null && read !== null && typeof read === "object"
    ? fields.every(([name, field]) => JSON.stringify((read as Record<string, unknown>)[name]) === JSON.stringify(field))
    : JSON.stringify(read === undefined || read === false && value.value === null ? null : read) === expected;
  let seen = false;
  let all = true;
  doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!all) return false;
    if (value.format.level === "paragraph" && node.isTextblock) {
      seen = true;
      all = matches(value.format.read({ level: "paragraph", node, doc, pos }));
      return false;
    }
    if (value.format.level === "character" && node.isText) {
      seen = true;
      all = matches(value.format.read({ level: "character", marks: node.marks }));
    }
    return true;
  });
  return seen && all;
}

/**
 * Restores the pre-edit selection mapped through the edit.
 * @param tr - Shared transaction.
 * @param selection - Selection before the edit.
 */
function restoreSelection(tr: Transaction, selection: QuireAiEditRange): void {
  // A caret stays a caret, and a selection never grows over content the edit inserted at its edges.
  const start = tr.mapping.mapResult(selection.from, 1);
  const end = tr.mapping.mapResult(selection.to, -1);
  const collapsed = selection.from === selection.to || start.deleted || end.deleted || end.pos <= start.pos;
  const from = collapsed ? tr.mapping.map(selection.from, -1) : start.pos;
  const to = collapsed ? from : end.pos;
  try {
    tr.setSelection(TextSelection.between(tr.doc.resolve(from), tr.doc.resolve(to)));
  } catch {
    tr.setSelection(Selection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size))));
  }
}
