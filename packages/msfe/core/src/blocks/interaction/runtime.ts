import { EditorSelection } from "@quirekit/cm-state";
import type { EditorView, ViewUpdate } from "@quirekit/cm-view";
import type { MsfeEditor, MsfeTarget } from "../../editor/types";
import { compositionField, modeFacet } from "../../state/fields";
import { sourceInputHasFocus, sourceInputFocusChanged, sourceInputElement } from "../../input/proxy/focus";
import { sourceBlockAt } from "../query";
import { sourceBlankLineAt } from "../insertion";
import { moveSourceBlock } from "../commands";
import { sourceBlockGeometry, sourcePositionAtPointer } from "./geometry";
import { blockDropAt, scrollBlockDrag } from "./drag";
import type { SourceBlock, SourceBlankLine } from "../types";
import type { SourceBlockControls, SourceBlockControlsOptions, SourceInsertionControls } from "./types";

/** Owns one bounded native interaction observer, never source DOM or a second selection. */
export class SourceBlockInteraction {
  private block: SourceBlock | null = null;
  private blank: SourceBlankLine | null = null;
  private pinned = false;
  private opening = false;
  private destroyed = false;
  private current: SourceBlockControls | null = null;
  private pointer: { x: number; y: number } | null = null;
  private gesture: { x: number; y: number; id: number; target: MsfeTarget; block: SourceBlock; active: boolean } | null = null;
  private frame = 0;
  private readonly win: Window;
  /** @param view - Canonical mounted view. @param editor - Lazy editor available after construction. @param options - Host-rendered controls. */
  constructor(private readonly view: EditorView, private readonly editor: () => MsfeEditor, private readonly options: SourceBlockControlsOptions) {
    this.win = view.dom.ownerDocument.defaultView!;
    view.dom.addEventListener("pointermove", this.hover);
    view.dom.ownerDocument.addEventListener("keydown", this.key);
    this.win.addEventListener("scroll", this.measure, true);
    this.win.addEventListener("resize", this.measure);
    this.win.addEventListener("blur", this.deactivate);
  }
  /** @returns Whether native editing currently permits block actions. */
  private enabled(): boolean {
    return !this.destroyed && !this.view.state.readOnly && !this.view.state.field(compositionField)
      && this.view.state.facet(modeFacet) === "live";
  }
  /** @param event - Native body pointer; at most one accepted coordinate query per frame. */
  private hover = (event: PointerEvent): void => {
    if (this.pinned || this.gesture || event.buttons || !this.enabled()) return;
    this.pointer = { x: event.clientX, y: event.clientY }; this.schedule();
  };
  /** Schedules native hit testing and measurement without rebuilding syntax or decorating source. */
  private schedule(): void {
    if (this.frame || this.destroyed) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      if (this.gesture?.active && this.pointer) scrollBlockDrag(this.view, this.pointer.y);
      this.measure();
      if (this.gesture?.active) this.schedule();
    });
  }
  /** @param position - One native hit, or null outside the editable surface. */
  private locate(position: number | null): void {
    this.blank = position !== null && this.options.insertionChange ? sourceBlankLineAt(this.view.state, position) : null;
    this.block = position !== null && !this.blank ? sourceBlockAt(this.view.state, position) : null;
  }
  /** Reads only the hovered/caret ancestor path and the source/target rectangles. */
  private measure = (): void => {
    if (!this.enabled()) { this.clear(); return; }
    this.view.requestMeasure({ key: this,
      read: view => {
        if (!this.pinned && !this.gesture && this.pointer) {
          const position = sourcePositionAtPointer(view, this.pointer.x, this.pointer.y);
          this.locate(position);
        }
        if (this.blank && !this.gesture) {
          const geometry = sourceBlockGeometry(view, this.blank);
          return geometry ? { kind: "insertion" as const, line: this.blank, rect: geometry.firstLine ?? geometry.rect } : null;
        }
        const block = this.gesture?.block ?? this.block;
        const geometry = block ? sourceBlockGeometry(view, block) ?? (this.gesture && this.current
          ? { rect: { ...this.current.rect, top: -10000, height: 0 }, firstLine: null } : null) : null;
        const drop = this.gesture?.active && this.pointer ? blockDropAt(view, this.gesture.block, this.pointer.x, this.pointer.y) : null;
        return block && geometry ? { kind: "block" as const, block, ...geometry, drop } : null;
      },
      write: value => {
        if (this.destroyed) return;
        if (!value || !this.enabled()) {
          this.opening = false; this.current = null; this.options.change(null); this.options.insertionChange?.(null); return;
        }
        if (value.kind === "insertion") {
          const editor = this.editor();
          const snapshot: SourceInsertionControls = { ...value, editor,
            target: { ...editor.captureTarget(), selection: EditorSelection.single(value.line.from, value.line.to) },
            pin: open => { this.pinned = open; if (!open) this.measure(); },
            focus: () => { if (!this.destroyed) editor.focus(); },
          };
          this.current = null; this.options.change(null); this.options.insertionChange?.(snapshot);
          if (this.opening) { this.opening = false; this.options.openInsertionMenu?.(snapshot); }
          return;
        }
        this.options.insertionChange?.(null);
        const editor = this.editor(), target = { ...editor.captureTarget(), selection: EditorSelection.single(value.block.from, value.block.to) };
        const snapshot: SourceBlockControls = { ...value, editor, target, dragging: this.gesture?.active ?? false, pointer: this.gesture ? this.pointer : null,
          press: event => this.press(event, snapshot),
          pin: open => { this.pinned = open; if (!open) this.measure(); },
          run: command => !this.destroyed && editor.run(command, target).ok,
          focus: () => { if (!this.destroyed) editor.focus(); },
        };
        this.current = snapshot; this.options.change(snapshot);
        if (this.opening) { this.opening = false; this.options.openMenu(snapshot); }
      },
    });
  };
  /** @param event - Handle pointerdown. @param controls - Exact intent before the gesture starts. */
  private press(event: PointerEvent, controls: SourceBlockControls): void {
    if (event.button !== 0 || !event.isPrimary || !this.enabled() || this.gesture) return;
    event.preventDefault();
    this.pinned = true; this.block = controls.block; this.pointer = { x: event.clientX, y: event.clientY };
    this.gesture = { ...this.pointer, id: event.pointerId, target: controls.target, block: controls.block, active: false };
    this.win.addEventListener("pointermove", this.drag);
    this.win.addEventListener("pointerup", this.release);
    this.win.addEventListener("pointercancel", this.cancel);
    this.win.addEventListener("keydown", this.escape, true);
  }
  /** @param event - Real pointer coordinates. */
  private drag = (event: PointerEvent): void => {
    if (!this.gesture || event.pointerId !== this.gesture.id) return;
    event.preventDefault(); this.pointer = { x: event.clientX, y: event.clientY };
    if (Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) >= 5) this.gesture.active = true;
    this.schedule();
  };
  /** @param event - Final native release; rechecks the target instead of trusting a stale indicator. */
  private release = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture || event.pointerId !== gesture.id) return;
    const drop = gesture.active && this.enabled() ? blockDropAt(this.view, gesture.block, event.clientX, event.clientY) : null;
    this.endGesture();
    if (!gesture.active && this.current) { this.pinned = true; this.options.openMenu(this.current); return; }
    if (drop) this.editor().run(moveSourceBlock(gesture.block, drop.block, drop.side), gesture.target);
    this.clear(); this.editor().focus();
  };
  /** @param event - Shortcut from the native editing surface. */
  private key = (event: KeyboardEvent): void => {
    if (event.target !== sourceInputElement(this.view) && !(event.target instanceof this.view.dom.ownerDocument.defaultView!.Node && this.view.dom.contains(event.target))) return;
    if (!event.altKey || !(event.metaKey || event.ctrlKey) || event.code !== "KeyB" || !this.enabled()) return;
    event.preventDefault(); this.pointer = null; this.locate(this.view.state.selection.main.head);
    this.pinned = true; this.opening = true; this.measure();
  };
  /** @param event - Escape cancels before it reaches the input owner. */
  private escape = (event: KeyboardEvent): void => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.cancel(); } };
  /** Ends a cancelled gesture without publishing any source change. */
  private cancel = (): void => { this.clear(); if (!this.destroyed) this.editor().focus(); };
  /** Window focus belongs to the user; retire controls without taking it back. */
  private deactivate = (): void => { this.clear(); };
  /** Releases transient gesture resources on every exit path. */
  private endGesture(): void {
    this.gesture = null; this.pinned = false;
    if (this.frame) this.win.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.win.removeEventListener("pointermove", this.drag); this.win.removeEventListener("pointerup", this.release);
    this.win.removeEventListener("pointercancel", this.cancel); this.win.removeEventListener("keydown", this.escape, true);
  }
  /** Retires stale controls and their captured revision. */
  private clear(): void {
    this.endGesture(); this.opening = false; this.block = null; this.blank = null; this.pointer = null; this.current = null;
    this.options.change(null); this.options.insertionChange?.(null);
  }
  /** @param update - Accepted native dependencies; text input closes an open menu or drag, while idle controls follow the caret in place. */
  update(update: ViewUpdate): void {
    if (!this.enabled()) { this.clear(); return; }
    const reactivated = update.startState.readOnly || update.startState.field(compositionField)
      || update.startState.facet(modeFacet) !== "live";
    if (update.docChanged && (this.pinned || this.gesture)) this.clear();
    if ((update.selectionSet || update.docChanged || sourceInputFocusChanged(update) || reactivated) && !this.pinned && !this.gesture) {
      this.pointer = null; this.locate(sourceInputHasFocus(update.view) ? update.state.selection.main.head : null);
      if (!update.state.selection.main.empty) this.blank = null;
    }
    if (update.selectionSet || update.docChanged || sourceInputFocusChanged(update) || reactivated || update.geometryChanged || update.viewportChanged) this.measure();
  }
  /** Disposes the view-owned observer and all host controls. */
  destroy(): void {
    this.destroyed = true; this.clear();
    this.view.dom.removeEventListener("pointermove", this.hover); this.view.dom.ownerDocument.removeEventListener("keydown", this.key);
    this.win.removeEventListener("scroll", this.measure, true); this.win.removeEventListener("resize", this.measure);
    this.win.removeEventListener("blur", this.deactivate);
  }
}
