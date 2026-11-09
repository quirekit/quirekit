<script setup lang="ts">
import { shallowRef, watch } from "vue";
import type { EditorState } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import { sourceInputHasFocus, readSourcePresentation, type MsfeEditor, type MsfeTarget } from "@quirekit/msfe-core";
import { QuirePopoverAnchor, QuirePopoverContent, QuirePopoverRoot } from "@quirekit/ui/vue";
import type { MdMentionSource } from "../../commands/types";
import type { MdDialogKind } from "../dialogs/types";
import type { MdFileMode } from "../files/types";
import { useMdOverlayTarget } from "../overlays/context";
import { mobileFloatingPopoverStyle } from "../mobile/controls";
import type { MdEditorLocale, MdSelectionAction } from "../types";
import Toolbar from "./toolbar.vue";
const props = defineProps<{
  /** Canonical source and native layout owner. */ editor: MsfeEditor;
  /** Accepted selection; geometry is read only after it changes. */ state: EditorState;
  /** Desktop presentation without another product task. */ enabled: boolean;
  /** Whether comments can be added; a readonly source then still offers the comment action. */ commentable?: boolean;
  /** Control language. */ locale: MdEditorLocale;
  /** Host contacts, forwarded to the shared toolbar context. */ mentions?: MdMentionSource | undefined;
  /** Host commands appended after the formatting actions. */ selectionActions?: readonly MdSelectionAction[] | undefined;
}>();
const emit = defineEmits<{
  /** Open a source-anchored product editor, such as the link dialog. */ edit: [kind: MdDialogKind, target?: MsfeTarget, body?: string];
  /** Unused by the selection preset; forwarded for contract parity. */ file: [mode: MdFileMode, exporter?: string];
  /** Open a comment draft for the selection. */ comment: [];
}>();
const portal = useMdOverlayTarget();
const position = shallowRef<{ left: string; top: string } | null>(null);
// A style menu opened from the floating toolbar takes focus; keep the toolbar until it closes.
const expanded = shallowRef(false);
const surface = shallowRef<HTMLElement | null>(null);

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
    const top = Math.min(...rects.map(rect => rect.top));
    const sameLine = start && end && Math.abs(start.top - end.top) < 4;
    const left = sameLine ? (start.left + end.right) / 2 : (start ?? end)!.left;
    position.value = { left: `${left}px`, top: `${top}px` };
  }
  /** Coalesce selection, focus, scroll and resize work into one frame. */
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
  doc.addEventListener("scroll", schedule, { capture: true, passive: true }); win.addEventListener("resize", schedule);
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
    doc.removeEventListener("scroll", schedule, true); win.removeEventListener("resize", schedule);
  });
}, { immediate: true });
</script>
<template>
  <QuirePopoverRoot :open="!!position" placement="top" :auto-focus="false" :restore-focus="false" :close-on-interact-outside="false">
    <QuirePopoverAnchor><span class="md-floating-toolbar-anchor" :style="position ?? undefined" /></QuirePopoverAnchor>
    <QuirePopoverContent v-if="position" width="auto" padding="none" :style="mobileFloatingPopoverStyle" :show-arrow="false" :portal-target="portal ?? 'body'">
      <div ref="surface" class="md-floating-toolbar" data-md-floating-toolbar>
        <Toolbar preset="selection" :active="!!position" :editor="editor" :state="state" :locale="locale" :mentions="mentions" :selection-actions="selectionActions"
          @edit="(...args) => emit('edit', ...args)" @comment="emit('comment')" @file="(...args) => emit('file', ...args)" @expanded="expanded = $event" />
      </div>
    </QuirePopoverContent>
  </QuirePopoverRoot>
</template>
<style scoped>
.md-floating-toolbar-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none; }
</style>
