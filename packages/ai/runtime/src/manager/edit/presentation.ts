import type { CommandProps, QuireEditor } from "@quirekit/core";
import type { QuireAiPresentation, QuireAiPresentationRole } from "../types";
import { applyQuireAiFormat, runQuireAiOperation, type QuireAiEditReport } from "./execute";
import { createQuireAiInlineContent } from "./text";
import type { QuireAiPlannedOperation } from "./types";

/** Range recorded in transaction coordinates after a given number of steps. */
interface RecordedRange {
  /** Range start when recorded. */
  readonly from: number;
  /** Range end when recorded. */
  readonly to: number;
  /** Visual role. */
  readonly role: QuireAiPresentationRole;
  /** Steps already in the transaction when recorded. */
  readonly step: number;
}

/**
 * Builds the in-document preview of a planned edit without changing the editor.
 *
 * The preview differs from the commit where content goes away: replaced text and
 * deleted blocks stay in the presented document, marked `removed`, so the user
 * sees what the edit takes out beside what it adds. Inserts, formats and actions
 * run exactly as they would commit.
 *
 * @param editor - Canonical editor; its state is the preview's base document.
 * @param operations - Operations planned against the current document.
 * @returns Preview, or null when the operations produce nothing to show.
 */
export function presentQuireAiEdit(
  editor: QuireEditor,
  operations: readonly QuireAiPlannedOperation[]
): QuireAiPresentation | null {
  const baseDoc = editor.state.doc;
  const recorded: RecordedRange[] = [];
  let failed = false;
  const transaction = editor.captureTransaction(() => {
    let chain = editor.chain();
    for (const operation of operations) {
      chain = chain.command((props: CommandProps) => {
        if (!presentOperation(props, operation, recorded)) failed = true;
        return true;
      });
    }
    chain.run();
  });
  if (failed || (transaction === null && recorded.length === 0)) return null;
  const steps = transaction?.steps ?? [];
  const ranges = recorded.flatMap(range => {
    const mapping = transaction === null ? null : transaction.mapping.slice(range.step);
    const from = mapping === null ? range.from : mapping.map(range.from, 1);
    const to = mapping === null ? range.to : mapping.map(range.to, -1);
    return to > from ? [{ from, to, role: range.role }] : [];
  });
  return { baseDoc, steps, ranges };
}

/**
 * Applies one operation to the preview transaction and records its ranges.
 * @param props - Command props of the shared transaction.
 * @param operation - Planned operation in start-document positions.
 * @param recorded - Receives ranges in current transaction coordinates.
 * @returns Whether the operation could be presented.
 */
function presentOperation(
  props: CommandProps,
  operation: QuireAiPlannedOperation,
  recorded: RecordedRange[]
): boolean {
  const { tr } = props;
  const map = (pos: number, assoc: -1 | 1) => tr.mapping.map(pos, assoc);
  const record = (from: number, to: number, role: QuireAiPresentationRole) => {
    recorded.push({ from, to, role, step: tr.steps.length });
  };
  try {
    switch (operation.kind) {
      case "replace-content":
      case "replace-text": {
        const whole = operation.kind === "replace-content";
        const from = map(operation.range.from, whole ? -1 : 1);
        const to = map(operation.range.to, whole ? 1 : -1);
        if (to < from) return false;
        record(from, to, "removed");
        if (operation.text.length === 0) return true;
        // Old text stays; new text follows it, inheriting marks only where the commit would keep them.
        if (whole) tr.insert(to, createQuireAiInlineContent(tr.doc.type.schema, operation.text));
        else tr.insertText(operation.text, to);
        record(to, to + operation.text.length, "inserted");
        return !whole || operation.spans.every(span =>
          applyQuireAiFormat(props, { from: to + span.start, to: to + span.end }, span));
      }
      case "delete":
        for (const range of operation.ranges) record(map(range.from, 1), map(range.to, -1), "removed");
        return true;
      case "move": {
        // The blocks show at their new place as inserted and stay at the old one as removed.
        const from = map(operation.from, 1);
        const to = map(operation.to, -1);
        const at = map(operation.at, operation.at <= operation.from ? -1 : 1);
        const content = tr.doc.slice(from, to).content;
        tr.insert(at, content);
        record(at, at + content.size, "inserted");
        const shift = at <= from ? content.size : 0;
        record(from + shift, to + shift, "removed");
        return true;
      }
      case "insert": {
        const at = map(operation.at, 1);
        const size = tr.doc.content.size;
        if (!runQuireAiOperation(props, operation, report())) return false;
        record(at, at + tr.doc.content.size - size, "inserted");
        return true;
      }
      case "format": {
        if (!runQuireAiOperation(props, operation, report())) return false;
        for (const target of operation.targets) record(map(target.from, 1), map(target.to, -1), "changed");
        return true;
      }
      case "action": {
        if (!runQuireAiOperation(props, operation, report())) return false;
        // Text actions mark the addressed text; block actions mark the block's content so the
        // range starts on the block's own line rather than at the boundary before it.
        if (operation.range !== null) {
          record(map(operation.range.from, 1), map(operation.range.to, -1), "changed");
          return true;
        }
        if (operation.pos === null) return true;
        const pos = map(operation.pos, 1);
        const node = tr.doc.nodeAt(pos);
        if (node === null) return true;
        if (node.isLeaf) record(pos, pos + node.nodeSize, "changed");
        else record(pos + 1, pos + node.nodeSize - 1, "changed");
        return true;
      }
    }
  } catch {
    return false;
  }
}

/** @returns Fresh outcome sink; preview ignores the commit-only facts. */
function report(): QuireAiEditReport {
  return { alreadySatisfied: false };
}
