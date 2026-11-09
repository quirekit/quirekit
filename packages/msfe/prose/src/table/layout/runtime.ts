import { ViewPlugin, type EditorView, type ViewUpdate } from "@quirekit/cm-view";
import { syntaxTree } from "@quirekit/cm-language";
import { MapMode } from "@quirekit/cm-state";
import { readSourcePresentation, type MsfeEditor } from "@quirekit/msfe-core";
import { measureTable } from "./measure";
import { readTableScroll, scrolledTableRow, tableScroller } from "./scroll";
import { mapTableLayoutCache } from "./cache";
import type { MeasuredTable, TableLayoutCache, TableLayoutMeasurement, TableLayoutWork } from "./types";

const counters = new WeakMap<HTMLElement, TableLayoutWork>();

/**
 * Resolved on demand: a position stored on the row would change, and redraw it, with every edit above the table.
 * @param view - Mounted source view.
 * @param row - Rendered table row.
 * @returns Current start of the row's table, which keys its layout, or null while that line is unparsed.
 */
function tableKeyOf(view: EditorView, row: HTMLElement): string | null {
  const line = view.state.doc.lineAt(view.posAtDOM(row));
  let key: string | null = null;
  syntaxTree(view.state).iterate({ from: line.from, to: line.to, enter: node => {
    if (key !== null) return false;
    if (node.name !== "Table") return true;
    key = String(node.from);
    return false;
  } });
  return key;
}

/** @param editor - Mounted editor. @returns Actual sampled layout work, independent of source serialization. */
export function getTableLayoutWork(editor: MsfeEditor): Readonly<TableLayoutWork> {
  return { ...counters.get(editor.element) ?? { measurements: 0, cells: 0 } };
}

/** Native rows, or their host table wrapper, share overflow without taking ownership of text or selection. */
export const tableLayout = ViewPlugin.define(view => {
  const work = { measurements: 0, cells: 0 };
  counters.set(view.dom, work);
  const cache = new Map<string, TableLayoutCache>(), offsets = new Map<string, number>();
  let groups: readonly MeasuredTable[] = [], disposed = false, dimensionsChanged = true;
  const context = view.dom.ownerDocument.createElement("canvas").getContext("2d");
  const ownerWindow = view.dom.ownerDocument.defaultView!;

  /** @returns Visible native rows measured in CM's read phase, bounded independently of document length. */
  function readTables(): readonly MeasuredTable[] {
    const presentation = readSourcePresentation(view.state);
    if (presentation.selecting) return groups;
    if (!context || presentation.mode === "source") return [];
    const nodes = new Map<string, HTMLElement[]>();
    for (const row of view.contentDOM.querySelectorAll<HTMLElement>(".msfe-table-row")) {
      const key = tableKeyOf(view, row);
      if (key === null) continue;
      if (!nodes.has(key)) nodes.set(key, []);
      nodes.get(key)!.push(row);
    }
    const result: MeasuredTable[] = [], tree = syntaxTree(view.state);
    for (const [key, rows] of nodes) {
      let value = cache.get(key);
      // Search/selection marks can recreate native row attributes. Reapply retained widths
      // to the current DOM without reading geometry or sampling canonical text again.
      if (value && (presentation.composing || !dimensionsChanged && !value.dirty && value.doc === view.state.doc && value.tree === tree)) {
        result.push({ key, rows, style: value.style }); continue;
      }
      let node = tree.resolveInner(Number(key), 1);
      while (node.parent && node.name !== "Table") node = node.parent;
      if (node.name !== "Table" || node.from !== Number(key)) continue;
      const unchanged = value && !value.dirty && value.from === node.from && value.to === node.to;
      if (value && unchanged && !dimensionsChanged) {
        cache.set(key, { ...value, doc: view.state.doc, tree });
        result.push({ key, rows, style: value.style }); continue;
      }
      const row = rows.find(value => !value.classList.contains("msfe-table-header") && !value.classList.contains("msfe-table-separator")) ?? rows[0]!;
      const cell = row.querySelector<HTMLElement>(".msfe-table-cell, .msfe-table-delimiter-cell");
      if (!cell) continue;
      const style = ownerWindow.getComputedStyle(row), cellStyle = ownerWindow.getComputedStyle(cell);
      const width = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const font = `${style.fontStyle} ${style.fontSize} ${style.fontFamily}`, size = parseFloat(style.fontSize);
      context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      const padding = parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight) + parseFloat(cellStyle.borderLeftWidth) + parseFloat(cellStyle.borderRightWidth);
      const metrics = `${font}/${style.letterSpacing}/${width}/${padding}`;
      // Composition retains already accepted widths on the *current* native rows.
      // Outside edits only map their source interval; they never resample table text.
      const measured = value && unchanged && value.metrics === metrics ? value.style : measureTable(view.state, node, width, font, size, padding, context, work);
      value = { from: node.from, to: node.to, dirty: false, doc: view.state.doc, tree, metrics, style: measured };
      cache.set(key, value);
      result.push({ key, rows, style: value.style });
    }
    // Only mounted table geometry is retained. Source remains in CM's immutable Text/tree.
    for (const key of cache.keys()) if (!nodes.has(key)) cache.delete(key);
    if (!presentation.composing) dimensionsChanged = false;
    return result;
  }

  /** @returns Fresh owner offsets, even while drag selection retains existing column geometry. */
  function read(): TableLayoutMeasurement {
    const tables = readTables();
    return { tables, scroll: readTableScroll(tables, offsets) };
  }
  /** @param next - Read-phase snapshot. Applies width and scroll properties without querying layout. */
  function write(next: TableLayoutMeasurement): void {
    if (disposed) return;
    groups = next.tables;
    let changed = false;
    for (const group of groups) for (const row of group.rows) {
      changed = applyWidths(row, group.style) || changed;
    }
    // All geometry was captured before these writes. Reading scrollLeft here
    // would force a layout after each row's inherited column properties change.
    for (const { element, left } of next.scroll) element.scrollLeft = left;
    if (changed) view.requestMeasure();
  }
  /** @param row - Current native row. @param widths - Accepted geometry. @returns Whether cached properties were restored, without any layout read. */
  function applyWidths(row: HTMLElement, widths: Readonly<Record<string, string>>): boolean {
    // A whole-table wrapper already owns this fragment's horizontal geometry.
    // Inherited widths survive CM replacing individual row style attributes.
    const owner = tableScroller(row);
    let changed = false;
    for (const [name, value] of Object.entries(widths)) if (owner.style.getPropertyValue(name) !== value) {
      owner.style.setProperty(name, value); changed = true;
    }
    return changed;
  }
  /** @param geometry - Whether actual layout dependencies may have changed. Coalesces native DOM refreshes. */
  function schedule(geometry = false): void { dimensionsChanged ||= geometry; if (!disposed) view.requestMeasure({ key: cache, read, write }); }
  /** @param event - Native scroll from a row or a host table wrapper, including keyboard caret reveal. */
  function scroll(event: Event): void {
    const row = scrolledTableRow(event.target);
    if (!row) return;
    const source = event.target as HTMLElement, key = tableKeyOf(view, row), left = source.scrollLeft;
    if (key === null) return;
    if (Math.abs((offsets.get(key) ?? 0) - left) < .5) return;
    offsets.delete(key); offsets.set(key, left);
    // Retain only the most recently scrolled tables, independently of document length.
    if (offsets.size > 64) offsets.delete(offsets.keys().next().value!);
    // A wrapper split by a viewport gap yields several scrollers for one table.
    for (const group of groups) if (group.key === key) for (const other of group.rows) {
      const scroller = tableScroller(other);
      if (scroller !== source) scroller.scrollLeft = left;
    }
    view.requestMeasure();
  }
  /** Font loading invalidates only mounted measurements, then coalesces with resize. */
  function fontsChanged(): void {
    for (const [key, value] of cache) cache.set(key, { ...value, dirty: true });
    schedule(true);
  }
  const resize = new ownerWindow.ResizeObserver(() => schedule(true));
  resize.observe(view.contentDOM);
  view.contentDOM.addEventListener("scroll", scroll, true);
  // Environments without the Font Loading API simply skip font-driven remeasurement.
  const fonts = view.dom.ownerDocument.fonts as FontFaceSet | undefined;
  fonts?.addEventListener("loadingdone", fontsChanged);
  schedule();
  return {
    /** Restores accepted geometry immediately after CM replaces row attributes, before the next paint. */
    docViewUpdate() {
      if (!cache.size) return;
      // Source transactions map cache keys before CM draws. This write-only phase
      // bridges redraws to the deferred measurement phase without an equal-width frame.
      for (const row of view.contentDOM.querySelectorAll<HTMLElement>(".msfe-table-row")) {
        const key = tableKeyOf(view, row), value = key === null ? undefined : cache.get(key);
        if (value) applyWidths(row, value.style);
      }
    },
    /** @param update - Accepted canonical update. */
    update(update: ViewUpdate) {
      if (update.docChanged) {
        mapTableLayoutCache(cache, update.changes);
        const mapped = [...offsets].map(([key, left]) => [update.changes.mapPos(Number(key), 1, MapMode.TrackDel), left] as const);
        offsets.clear(); for (const [key, left] of mapped) if (key !== null) offsets.set(String(key), left);
      }
      schedule(update.docChanged || update.viewportChanged || update.geometryChanged || syntaxTree(update.startState) !== syntaxTree(update.state)
        || update.transactions.some(transaction => transaction.reconfigured)
        || readSourcePresentation(update.startState).selecting && !readSourcePresentation(update.state).selecting);
    },
    /** Drops observers, queued writes and retained geometry at the mounted lifetime boundary. */
    destroy() { disposed = true; resize.disconnect(); view.contentDOM.removeEventListener("scroll", scroll, true);
      fonts?.removeEventListener("loadingdone", fontsChanged); cache.clear(); offsets.clear(); groups = []; counters.delete(view.dom); },
  };
});
