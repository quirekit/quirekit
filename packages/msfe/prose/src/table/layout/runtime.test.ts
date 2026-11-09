import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import type { EditorView, ViewUpdate } from "@quirekit/cm-view";
import { tableLayout } from "./runtime";

const presentation = vi.hoisted(() => ({ selecting: false }));
vi.mock("@quirekit/msfe-core", () => ({ readSourcePresentation: () => ({ mode: "live", ...presentation }) }));
afterEach(() => { presentation.selecting = false; });

/**
 * Keeps native geometry access observable without relying on machine-dependent timing.
 * @param wrapped - Whether both rows share one horizontal scrolling wrapper.
 * @returns The real layout plugin with a controlled CM read/write scheduler.
 */
function fixture(wrapped = false) {
  const events: string[] = [], positions = [40, 40];
  const state = EditorState.create({ doc: "| A | B |\n| --- | --- |\n| one | two |", extensions: markdown({ extensions: GFM }) });
  let pending: Parameters<EditorView["requestMeasure"]>[0], listener: ((event: Event) => void) | undefined;
  /** @param index - Physical scroll owner. @returns An instrumented native scroll position. */
  function scrollPosition(index: number) {
    return { get scrollLeft() { events.push(`read:${index}`); return positions[index]!; },
      set scrollLeft(left: number) { events.push(`scroll:${index}`); positions[index] = left; } };
  }
  /** @param owner - Physical style owner. @returns Observable inline column properties. */
  function columnStyle(owner: string) {
    const values = new Map<string, string>();
    return { getPropertyValue: (name: string) => values.get(name) ?? "",
      setProperty: (name: string, value: string) => { events.push(`width:${owner}`); values.set(name, value); } };
  }
  const wrapper = Object.defineProperty({ hasAttribute: () => true, style: columnStyle("shared") }, "scrollLeft",
    Object.getOwnPropertyDescriptor(scrollPosition(0), "scrollLeft")!);
  const rows = [0, 1].map(index => {
    return Object.defineProperty({ parentElement: wrapped ? wrapper : null,
      classList: { contains: (name: string) => name === "msfe-table-row" }, clientWidth: 500,
      querySelector: () => ({}), style: columnStyle(String(index)),
    }, "scrollLeft", Object.getOwnPropertyDescriptor(scrollPosition(index), "scrollLeft")!) as unknown as HTMLElement;
  });
  const ownerDocument = { createElement: () => ({ getContext: () => ({ measureText: (source: string) => ({ width: source.length * 8 }) }) }),
    defaultView: { ResizeObserver: class {
      /** Accepts a mount without delivering unrelated resize callbacks. */
      observe() {}
      /** Releases this inert test observer. */
      disconnect() {}
    }, getComputedStyle: () => ({ fontStyle: "normal", fontSize: "16px", fontFamily: "sans-serif",
      letterSpacing: "normal", paddingLeft: "4", paddingRight: "4", borderLeftWidth: "1", borderRightWidth: "1" }) } };
  const view = { state, posAtDOM: () => 0, dom: { ownerDocument }, contentDOM: { querySelectorAll: () => rows,
    addEventListener: (_name: string, callback: (event: Event) => void) => { listener = callback; }, removeEventListener: () => {} },
    requestMeasure: (request?: Parameters<EditorView["requestMeasure"]>[0]) => { if (request) pending = request; },
  } as unknown as EditorView;
  const runtime = tableLayout.create(view, undefined);
  events.length = 0;
  /** Runs exactly one native read/write checkpoint; queued follow-ups stay separate. */
  function measure(): void {
    const request = pending!;
    const measured = request.read(view);
    request.write?.(measured, view);
  }
  /** Schedules a source-neutral viewport update. */
  function update(): void {
    runtime.update({ state, startState: state, transactions: [], docChanged: false, viewportChanged: true, geometryChanged: false } as unknown as ViewUpdate);
  }
  /** @param index - Row whose native horizontal scroll changed. */
  function scroll(index: number): void { listener!({ target: rows[index] } as unknown as Event); }
  return { runtime, events, positions, rows, measure, update, scroll };
}

describe("table layout read/write ownership", () => {
  it("reads scroll offsets before any column width writes and restores untracked offsets", () => {
    const value = fixture();
    value.measure();
    const firstWrite = value.events.findIndex(event => event.startsWith("width:"));
    expect(firstWrite).toBeGreaterThanOrEqual(0);
    expect(value.events.slice(firstWrite).filter(event => event.startsWith("read:"))).toEqual([]);
    expect(value.positions).toEqual([0, 0]);
    value.runtime.destroy();
  });

  it("reads a shared table wrapper once rather than once per rendered row", () => {
    const value = fixture(true);
    value.measure();
    expect(value.events.filter(event => event.startsWith("read:"))).toEqual(["read:0"]);
    expect(value.events.filter(event => event.startsWith("scroll:"))).toEqual(["scroll:0"]);
    value.runtime.destroy();
  });

  it("keeps one set of inherited widths on the wrapper when native row attributes are redrawn", () => {
    const value = fixture(true);
    value.measure();
    expect(value.events.filter(event => event.startsWith("width:"))).toEqual(["width:shared", "width:shared"]);
    expect(value.rows.every(row => row.style.getPropertyValue("--msfe-table-col-0") === "")).toBe(true);
    value.events.length = 0;
    value.runtime.docViewUpdate();
    expect(value.events).toEqual([]);
    value.runtime.destroy();
  });

  it("restores retained horizontal offsets on fresh DOM and rereads while drag selection retains widths", () => {
    const value = fixture();
    value.measure();
    value.positions[0] = 75;
    value.scroll(0);
    expect(value.positions).toEqual([75, 75]);
    value.positions[1] = 0;
    value.update(); value.measure();
    expect(value.positions).toEqual([75, 75]);
    presentation.selecting = true;
    value.positions[1] = 12;
    value.events.length = 0;
    value.update(); value.measure();
    expect(value.positions).toEqual([75, 75]);
    expect(value.events.filter(event => event.startsWith("scroll:"))).toEqual(["scroll:1"]);
    value.events.length = 0;
    value.update(); value.measure();
    expect(value.events.filter(event => event.startsWith("scroll:") || event.startsWith("width:"))).toEqual([]);
    value.runtime.destroy();
  });
});
