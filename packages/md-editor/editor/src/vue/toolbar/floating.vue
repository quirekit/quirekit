<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import type { EditorState } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { sourceInputHasFocus, readSourcePresentation, type MsfeEditor, type MsfeTarget } from "@quirekit/msfe-core";
import type { MdMentionSource } from "../../commands/types";
import type { MdDialogKind } from "../dialogs/types";
import type { MdFileMode } from "../files/types";
import { useMdDocumentLayer } from "../overlays/context";
import type { MdEditorLocale, MdSelectionAction } from "../types";
import { placeMdFloatingToolbar, type MdFloatingAnchor, type MdFloatingSize } from "./floating-placement";
import Toolbar from "./toolbar.vue";
const props = defineProps<{
  /** Canonical source and native layout owner. */ editor: MsfeEditor;
  /** Accepted selection; geometry is read only after it changes. */ state: EditorState;
  /** Desktop presentation without another product task. */ enabled: boolean;
  /** Whether comments can be added; a readonly source then still offers the comment action. */ commentable?: boolean;
  /** Control language. */ locale: MdEditorLocale;
  /** Host contacts, forwarded to the shared toolbar context. */ mentions?: MdMentionSource | undefined;
  /** Host commands appended after the formatting actions. */ selectionActions?: readonly MdSelectionAction[] | undefined;
  /** @returns Height of sticky chrome above the document; the toolbar flips below a selection it would cover. */ stickyTop: () => number;
}>();
const emit = defineEmits<{
  /** Open a source-anchored product editor, such as the link dialog. */ edit: [kind: MdDialogKind, target?: MsfeTarget, body?: string];
  /** Unused by the selection preset; forwarded for contract parity. */ file: [mode: MdFileMode, exporter?: string];
  /** Open a comment draft for the selection. */ comment: [];
}>();
const layer = useMdDocumentLayer();
// Layer-local geometry: the toolbar is an absolute child of the document layer, so the browser
// scrolls it with the text and no scroll listener repositions it.
const position = shallowRef<MdFloatingAnchor | null>(null);
// A style menu opened from the floating toolbar takes focus; keep the toolbar until it closes.
const expanded = shallowRef(false);
const surface = shallowRef<HTMLElement | null>(null);
const size = shallowRef<MdFloatingSize | null>(null);
const placement = computed(() => position.value && size.value ? placeMdFloatingToolbar(position.value, size.value) : null);
// The first frame renders hidden at the anchor to learn the toolbar's box; placement needs its width and height.
const style = computed(() => {
  const anchor = position.value, placed = placement.value;
  if (!anchor) return undefined;
  return placed ? { left: `${placed.left}px`, top: `${placed.top}px` } : { left: `${anchor.center}px`, top: `${anchor.top}px`, visibility: "hidden" as const };
});

/**
 * @param element - Editor element.
 * @returns Client top of the nearest scrollport, which clips the document above it; the window's top edge when none scrolls.
 */
function scrollportTop(element: HTMLElement): number {
  const win = element.ownerDocument.defaultView!;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll|overlay)/u.test(win.getComputedStyle(parent).overflowY)) return Math.max(0, parent.getBoundingClientRect().top);
  }
  return 0;
}

// The toolbar's own box changes with the offered actions; track it instead of assuming a width.
watch(surface, (element, _old, cleanup) => {
  if (!element) { size.value = null; return; }
  const read = (): void => { size.value = { width: element.offsetWidth, height: element.offsetHeight }; };
  const Observer = element.ownerDocument.defaultView?.ResizeObserver, observer = Observer ? new Observer(read) : null;
  observer?.observe(element); read();
  cleanup(() => observer?.disconnect());
}, { flush: "post" });

// Release the old overlay in the same render turn, before a parameter dialog joins
// the layer stack. Deferring this to geometry RAF would dismiss the newer task.
watch(() => props.enabled, enabled => {
  if (!enabled) { expanded.value = false; position.value = null; }
}, { flush: "sync" });

watch(() => props.editor, (editor, _old, cleanup) => {
  const element = editor.element, doc = element.ownerDocument, win = doc.defaultView!;
  let frame = 0, pressing = false, dismissed = false;
  /** Center above the selected range's mounted endpoints; no text or syntax scan. */
  function measure(): void {
    frame = 0;
    const view = EditorView.findFromDOM(element), range = editor.state.selection.main;
    const focused = !!view && (sourceInputHasFocus(view) || expanded.value || !!surface.value?.contains(doc.activeElement));
    const readOnly = editor.state.readOnly || editor.mode === "locked";
    if (!props.enabled || !view || range.empty || pressing || dismissed || !focused || readOnly && !props.commentable || view.composing || readSourcePresentation(view.state).composing) {
      if (!expanded.value) position.value = null;
      return;
    }
    const visible = (pos: number): boolean => view.visibleRanges.some(value => pos >= value.from && pos <= value.to);
    const start = visible(range.from) ? view.coordsAtPos(range.from, 1) : null, end = visible(range.to) ? view.coordsAtPos(range.to, -1) : null;
    const rects = [start, end].filter(rect => !!rect);
    if (!rects.length) { position.value = null; return; }
    const origin = layer.value?.getBoundingClientRect();
    if (!origin) { position.value = null; return; }
    const top = Math.min(...rects.map(rect => rect.top)), bottom = Math.max(...rects.map(rect => rect.bottom));
    const sameLine = start && end && Math.abs(start.top - end.top) < 4;
    const left = sameLine ? (start.left + end.right) / 2 : (start ?? end)!.left;
    position.value = { center: left - origin.left, top: top - origin.top, bottom: bottom - origin.top, layerWidth: origin.width,
      clearTop: scrollportTop(element) + props.stickyTop() - origin.top };
  }
  /** Coalesce selection, focus and size work into one frame; scrolling needs none. */
  function schedule(): void { if (!frame) frame = win.requestAnimationFrame(measure); }
  /** Hide while a pointer is still shaping the selection. */
  function press(): void { pressing = true; dismissed = false; if (!expanded.value) position.value = null; }
  /** Show the settled selection after release. */
  function release(): void { if (!pressing) return; pressing = false; schedule(); }
  /** @param event - Escape hides the toolbar until the selection changes. */
  function keydown(event: KeyboardEvent): void { if (event.key === "Escape" && position.value) { dismissed = true; position.value = null; } }
  element.addEventListener("pointerdown", press, { capture: true });
  doc.addEventListener("pointerup", release); doc.addEventListener("pointercancel", release);
  element.addEventListener("keydown", keydown, true);
  element.addEventListener("focusin", schedule); element.addEventListener("focusout", schedule);
  // Layer-local geometry is invariant under scrolling; it changes when the content reflows
  // (an image loads, a block edits) or the window resizes.
  const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null, content = EditorView.findFromDOM(element)?.contentDOM;
  if (content) resize?.observe(content);
  win.addEventListener("resize", schedule);
  const stop = watch([() => props.state.selection, () => props.enabled, expanded, () => props.commentable], ([selection], previous) => {
    if (previous && selection !== previous[0]) dismissed = false;
    schedule();
  }, { immediate: true });
  cleanup(() => {
    stop(); if (frame) win.cancelAnimationFrame(frame);
    element.removeEventListener("pointerdown", press, true);
    doc.removeEventListener("pointerup", release); doc.removeEventListener("pointercancel", release);
    element.removeEventListener("keydown", keydown, true);
    element.removeEventListener("focusin", schedule); element.removeEventListener("focusout", schedule);
    resize?.disconnect(); win.removeEventListener("resize", schedule);
  });
}, { immediate: true });
</script>
<template>
  <div v-if="position" ref="surface" class="md-floating-toolbar" data-md-floating-toolbar :data-side="placement?.side" :style="style">
    <!-- Rendered inside the document layer: absolute, in layer pixels, moved by the browser while scrolling. -->
    <Toolbar preset="selection" :active="!!position" :editor="editor" :state="state" :locale="locale" :mentions="mentions" :selection-actions="selectionActions"
      @edit="(...args) => emit('edit', ...args)" @comment="emit('comment')" @file="(...args) => emit('file', ...args)" @expanded="expanded = $event" />
  </div>
</template>
<style scoped>
/* Above the block and object surfaces of the same layer; the layer itself ignores the pointer. */
.md-floating-toolbar { position: absolute; z-index: 6; width: max-content; max-width: calc(100% - 16px); pointer-events: auto; }
</style>
