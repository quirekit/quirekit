import { Decoration } from "@quirekit/cm-view";
import { TableSpacer } from "./widget";
import type { ProjectionContext } from "@quirekit/msfe-core";
import { isSourceActive } from "@quirekit/msfe-core";
import { tableReadingModel } from "./reading/model";

/**
 * Gives native text cells a common column grid without replacing editable content.
 * @param input - Confirmed table and viewport-local source coordinates.
 * @returns Header, delimiter and cell decorations; no document mutation.
 */
export function projectTable({ state, node, from, to, active, selection, mode }: ProjectionContext) {
  const header = node.getChild("TableHeader");
  if (!header) return [];
  let separator = header.nextSibling;
  while (separator?.name === "QuoteMark") separator = separator.nextSibling;
  const alignments = separator?.name === "TableDelimiter" ? state.sliceDoc(separator.from, separator.to).trim().replace(/^\||\|$/gu, "").split("|") : [];
  const count = alignments.length;
  if (!count) return [];
  const result = [];
  const reading = mode === "locked" ? tableReadingModel(state, node) : undefined;
  // The delimiter owns the grid, even with empty header cells. Seek directly into the
  // viewport so a long table does not rescan all preceding rows on every selection.
  for (let row = node.childAfter(Math.max(node.from, from)); row && row.from <= to; row = row.nextSibling) {
    if (row.name !== "TableHeader" && row.name !== "TableRow" && row.name !== "TableDelimiter") continue;
    const line = state.doc.lineAt(row.from);
    const delimiter = row.name === "TableDelimiter";
    const rowActive = active && isSourceActive(selection, row.from, row.to);
    result.push(Decoration.line({ class: `msfe-table-row${row.name === "TableHeader" ? " msfe-table-header" : ""}${delimiter ? " msfe-table-separator" : ""}${active ? " msfe-table-active" : ""}${row.to === node.to ? " msfe-table-last" : ""}`,
      attributes: { style: `--msfe-table-columns:${count}`,
        ...(reading ? delimiter ? { "aria-hidden": "true" } : { role: "row", "aria-rowindex": String(reading.indexes.get(row.from)) } : {}) } }).range(line.from));
    if (delimiter) {
      // The delimiter has its own permanent, compact grid row. Visibility changes only
      // its ink, never the height or the column origins of subsequent body rows.
      const source = state.sliceDoc(row.from, row.to);
      let offset = row.from;
      let column = 0;
      for (const part of source.split(/(\|)/u)) {
        const end = offset + part.length;
        if (part === "|") result.push(Decoration.mark({ class: "msfe-table-pipe" }).range(offset, end));
        else if (part.length) result.push(Decoration.mark({ class: "msfe-table-delimiter-cell", attributes: { style: `width:var(--msfe-table-col-${column++}, calc(100% / var(--msfe-table-columns)))` } }).range(offset, end));
        offset = end;
      }
      continue;
    }
    const pipes = row.getChildren("TableDelimiter");
    // Each cell owns the pipe before it, so its first position measures inside the cell rather than the previous cell's box.
    let start = row.from;
    let index = 0;
    let hiddenFrom = row.to;
    // The closing pipe belongs to the last cell for the same reason.
    const ends = pipes.filter(pipe => pipe.from > start && pipe.to < row.to).map(pipe => pipe.from);
    ends.push(row.to);
    const surplus = ends.length > count;
    // Include surrounding source whitespace in each cell box. Parser cell ranges trim it,
    // which otherwise produces unequal offsets and drops empty cells between pipes.
    for (const end of ends) {
      // GFM ignores excess cells in rendered output. Keep their exact source available
      // when active instead of allowing a surplus cell to widen the document grid.
      if (index >= count) {
        hiddenFrom = start;
        if (!rowActive && start < row.to) result.push(Decoration.replace({}).range(start, row.to));
        break;
      }
      const alignment = alignments[index]?.trim() ?? "";
      const align = alignment.endsWith(":") ? alignment.startsWith(":") ? "center" : "right" : "left";
      const cellEnd = surplus && index === count - 1 && rowActive ? row.to : end;
      // Boundary insertions, including transient IME widgets, belong inside the
      // cell's layout owner instead of becoming extra flex children of the row.
      if (cellEnd > start) result.push(Decoration.mark({ class: "msfe-table-cell", inclusive: true, attributes: { style: `text-align:${align};width:var(--msfe-table-col-${index}, calc(100% / var(--msfe-table-columns)))`,
        ...(reading ? { role: row.name === "TableHeader" ? "columnheader" : "cell", "aria-colindex": String(index + 1) } : {}) } }).range(start, cellEnd));
      else result.push(Decoration.widget({ widget: new TableSpacer(index, reading ? row.name === "TableHeader" ? "columnheader" : "cell" : undefined), side: -1 }).range(start));
      if (surplus && index === count - 1 && rowActive) {
        // Malformed surplus source is available inside the final real column, rather
        // than becoming an extra flex column outside the document. Other rows stay projected.
        result.push(Decoration.mark({ class: "msfe-table-surplus" }).range(end, row.to));
        hiddenFrom = end; index++; break;
      }
      start = end; index++;
    }
    for (; index < count; index++) result.push(Decoration.widget({ widget: new TableSpacer(index, reading ? row.name === "TableHeader" ? "columnheader" : "cell" : undefined), side: 1 }).range(row.to));
    for (const mark of pipes) if (mark.to <= hiddenFrom) result.push(Decoration.mark({ class: "msfe-table-pipe", ...(reading ? { attributes: { "aria-hidden": "true" } } : {}) }).range(mark.from, mark.to));
  }
  return result;
}
