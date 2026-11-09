<script setup lang="ts">
import { computed, ref } from "vue";
import { QuireTaskPanel, QuireActionDirectory, QuireMenu, QuireMenuItem, QuireMenuSubmenu, QuireMenuSeparator, QuireIcon } from "@quirekit/ui/vue";
import { insertSourceBlock, moveSourceBlock, removeSourceBlock, sourceBlockSibling, withSourceOperation, type SourceBlockControls, type SourceBlockSide, type MsfeCommand } from "@quirekit/msfe-core";
import type { MdEditorLocale } from "../types";
import { blockLabels } from "./labels";
import { blockInsertionSource } from "./insertion/catalog";
import InsertList from "./insertion/list.vue";
import { useMdOverlayTarget } from "../overlays/context";
import Format from "./format.vue";
import HighlightColors from "./highlight/menu.vue";
import { mobileActionDirectory } from "../mobile/catalog";
import { blockInsertionItems } from "./insertion/catalog";
const props = defineProps<{
  /** Exact block intent, pinned until dismissal or document change. */ controls: SourceBlockControls;
  /** Product language. */ locale: MdEditorLocale;
  /** Host contact capability. */ mentions: boolean;
}>();
const emit = defineEmits<{ /** Dismiss the owned menu. */ close: [];
  /** Open a deferred parameter editor without mutating source. */ insert: [side: SourceBlockSide, value: string];
}>();
const portal = useMdOverlayTarget();
const mobile = !!props.controls.editor.element.ownerDocument.defaultView?.matchMedia("(max-width: 767px)").matches;
const page = ref<SourceBlockSide | "">("");
const handoff = ref(false);
const text = computed(() => blockLabels(props.locale));
const error = ref("");
const previous = computed(() => sourceBlockSibling(props.controls.editor.state, props.controls.block, -1));
const next = computed(() => sourceBlockSibling(props.controls.editor.state, props.controls.block, 1));
const actions = computed(() => page.value ? mobileActionDirectory(blockInsertionItems(props.controls.editor, props.locale, props.mentions)) : [
  { kind: "command" as const, value: "before", label: text.value.before, icon: "moveUp" },
  { kind: "command" as const, value: "after", label: text.value.after, icon: "moveDown" },
  { kind: "command" as const, value: "up", label: text.value.up, icon: "moveUp", disabled: !previous.value },
  { kind: "command" as const, value: "down", label: text.value.down, icon: "moveDown", disabled: !next.value },
  { kind: "command" as const, value: "copy", label: text.value.copy, icon: "copy" },
  { kind: "command" as const, value: "cut", label: text.value.cut, icon: "scissors" },
  { kind: "command" as const, value: "duplicate", label: text.value.duplicate, icon: "copy" },
  { kind: "command" as const, value: "delete", label: text.value.remove, icon: "trash", danger: true },
]);
/** @param value - Current bottom page command, rechecked by existing guarded source controls. */
function mobileAction(value: string): void {
  if (page.value) { insert(page.value, value); return; }
  if (value === "before" || value === "after") { page.value = value; return; }
  if (value === "copy" || value === "cut") { void copy(value === "cut"); return; }
  const { controls } = props;
  if (value === "up" && previous.value) execute(withSourceOperation(moveSourceBlock(controls.block, previous.value, "before"), { kind: "block.move" }));
  else if (value === "down" && next.value) execute(withSourceOperation(moveSourceBlock(controls.block, next.value, "after"), { kind: "block.move" }));
  else if (value === "delete") execute(withSourceOperation(removeSourceBlock(controls.block), { kind: "block.remove" }));
  else if (value === "duplicate") execute(withSourceOperation(insertSourceBlock(controls.block, "after", controls.editor.state.sliceDoc(controls.block.from, controls.block.to)), { kind: "block.duplicate" }));
}
/** @param command - Guarded explicit source action. */
function execute(command: MsfeCommand): void {
  if (props.controls.run(command)) { emit("close"); props.controls.focus(); } else error.value = text.value.stale;
}
/** @param side - Explicit adjacent boundary. @param id - Complete Markdown template. */
function insert(side: SourceBlockSide, id: string): void {
  const source = blockInsertionSource(props.controls.editor, props.locale, id);
  if (source !== null) execute(withSourceOperation(insertSourceBlock(props.controls.block, side, source), { kind: "block.insert", facts: { type: id.replace(/^insert-/u, "") } }));
  else { handoff.value = true; emit("insert", side, id); emit("close"); }
}
/** @param cut - Delete only after successful clipboard publication at the captured revision. */
async function copy(cut = false): Promise<void> {
  const { controls } = props;
  try {
    const { editor, block, target } = controls;
    if (editor.revision !== target.revision) { error.value = text.value.stale; return; }
    await navigator.clipboard.writeText(editor.state.sliceDoc(block.from, block.to));
    if (cut) execute(withSourceOperation(removeSourceBlock(block), { kind: "text.cut" }));
    else { emit("close"); controls.focus(); }
  } catch { error.value = text.value.failed; }
}
</script>
<template>
  <QuireTaskPanel v-if="mobile" :open="true" :title="page ? text[page] : text.menu" presentation="bottom" :anchor-el="() => controls.editor.element" :restore-focus="!handoff" :final-focus-el="() => controls.editor.element.querySelector('[contenteditable=true]')" :portal-target="portal ?? 'body'" :can-go-back="!!page" @back="page = ''" @update:open="!$event && emit('close')">
    <Format v-if="!page" :controls="controls" :locale="locale" :divider="false" @close="emit('close')" />
    <HighlightColors v-if="!page" :controls="controls" :locale="locale" inline @close="emit('close')" />
    <QuireActionDirectory :actions="actions" :layout="page ? 'grid' : 'list'" @activate="mobileAction" />
    <p v-if="error" role="status">{{ error }}</p>
  </QuireTaskPanel>
  <QuireMenu v-else :portal-target="portal ?? 'body'" :open="true" :anchor-point="{ x: Math.max(8, controls.rect.left - 36), y: controls.rect.top + 28 }" placement="left-start" width="232px"
    :aria-label="text.menu" initial-focus="menu" :close-on-select="false" :lang="locale" data-md-block-menu @update:open="!$event && emit('close')">
    <Format :controls="controls" :locale="locale" @close="emit('close')" />
    <HighlightColors :controls="controls" :locale="locale" @close="emit('close')" />
    <QuireMenuSubmenu v-for="side in (['before', 'after'] as const)" :key="side" width="224px">
      <template #leading><QuireIcon :name="side === 'before' ? 'tableInsertRowAbove' : 'tableInsertRowBelow'" /></template>
      <template #trigger>{{ text[side] }}</template>
      <InsertList :target="{ controls, side }" :locale="locale" :mentions="mentions" @select="insert(side, $event)" />
    </QuireMenuSubmenu>
    <QuireMenuSeparator />
    <QuireMenuItem value="up" :disabled="!previous" @select="previous && execute(withSourceOperation(moveSourceBlock(controls.block, previous, 'before'), { kind: 'block.move' }))"><template #leading><QuireIcon name="moveUp" /></template>{{ text.up }}</QuireMenuItem>
    <QuireMenuItem value="down" :disabled="!next" @select="next && execute(withSourceOperation(moveSourceBlock(controls.block, next, 'after'), { kind: 'block.move' }))"><template #leading><QuireIcon name="moveDown" /></template>{{ text.down }}</QuireMenuItem>
    <QuireMenuSeparator />
    <QuireMenuItem value="copy" @select="copy()"><template #leading><QuireIcon name="copy" /></template>{{ text.copy }}</QuireMenuItem>
    <QuireMenuItem value="cut" @select="copy(true)"><template #leading><QuireIcon name="scissors" /></template>{{ text.cut }}</QuireMenuItem>
    <QuireMenuItem value="duplicate" @select="execute(withSourceOperation(insertSourceBlock(controls.block, 'after', controls.editor.state.sliceDoc(controls.block.from, controls.block.to)), { kind: 'block.duplicate' }))"><template #leading><QuireIcon name="files" /></template>{{ text.duplicate }}</QuireMenuItem>
    <QuireMenuItem value="delete" tone="danger" @select="execute(withSourceOperation(removeSourceBlock(controls.block), { kind: 'block.remove' }))"><template #leading><QuireIcon name="trash" /></template>{{ text.remove }}</QuireMenuItem>
    <p v-if="error" role="status" class="m-0 p-qk-inline qk-type-helper text-qk-text-secondary">{{ error }}</p>
  </QuireMenu>
</template>
