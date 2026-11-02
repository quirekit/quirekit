import { countColumn, type ChangeSpec, type TransactionSpec } from "@quirekit/cm-state";
import { insertNewlineContinueMarkup } from "@quirekit/cm-lang-markdown";
import type { MsfeCommand } from "@quirekit/msfe-core";
import { listContext, listIndentStart, markerWidth, previousListItem } from "./context";
import { renumberMove, separateUnwrapped } from "./restructure";

/** @param direction - Nest or lift one level. @returns Atomic whole-item edit that maps the directed source selection. */
export function changeListIndent(direction: 1 | -1): MsfeCommand {
  return state => {
    const context = listContext(state);
    if (!context) return null;
    const previous = previousListItem(context.items[0]!);
    if (direction > 0 && previous?.name !== "ListItem") return null;
    const width = direction > 0 ? markerWidth(state, previous!) : context.parent ? markerWidth(state, context.parent) : markerWidth(state, context.items[0]!);
    const changes: ChangeSpec[] = [];
    // Move every descendant line exactly once, at the list's own indentation
    // boundary. Nested quote markers and task text remain canonical source.
    for (const item of context.items) {
      const first = state.doc.lineAt(item.from), last = state.doc.lineAt(item.to);
      for (let number = first.number; number <= last.number; number++) {
        const line = state.doc.line(number), start = listIndentStart(line.text, context.quotes);
        if (direction > 0) changes.push({ from: line.from + start, insert: " ".repeat(width) });
        else if (!context.parent && number === first.number) {
          const marker = item.getChild("ListMark")!, task = item.getChild("Task")?.getChild("TaskMarker");
          const end = task ? task.to + Number(state.sliceDoc(task.to, task.to + 1) === " ") : Math.min(line.to, marker.from + markerWidth(state, item));
          changes.push({ from: marker.from, to: end });
        } else {
          const whitespace = /^[ \t]*/u.exec(line.text.slice(start))![0];
          const columns = countColumn(whitespace, 4);
          // Tabs are expanded only in the affected indentation. A malformed lazy
          // continuation with no indent remains content instead of losing characters.
          if (columns) changes.push({ from: line.from + start, to: line.from + start + whitespace.length, insert: " ".repeat(Math.max(0, columns - width)) });
        }
      }
    }
    changes.push(...renumberMove(state, context, direction));
    if (direction < 0 && !context.parent) changes.push(...separateUnwrapped(state, context));
    const edits = state.changes(changes);
    return { changes: edits, selection: state.selection.map(edits), scrollIntoView: true };
  };
}

/** @returns Official CM Markdown continuation compiled into the same atomic command draft. */
export function continueList(): MsfeCommand {
  return state => {
    if (!listContext(state)) return null;
    let spec: TransactionSpec | null = null;
    insertNewlineContinueMarkup({ state, dispatch(transaction) {
      spec = { changes: transaction.changes, selection: transaction.newSelection, effects: transaction.effects, scrollIntoView: true };
    } });
    return spec;
  };
}
