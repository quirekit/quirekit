<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { QuireMenu, QuireMenuItems, QuireMenuSubmenu, QuireMenuItem, QuireMenuSeparator, QuireIcon,
  QuireToolbarDisclosure, QuireEmojiPicker, QuireCalendar, QuireButton, type QuireKitToolbarRendererScope } from "@quirekit/ui/vue";
import type { QuireKitEmojiItem } from "@quirekit/ui";
import { insertMdDate, insertMdText } from "../../commands/portable";
import type { MdToolbarContext } from "./types";
import { insertionItems, toolbarInsertions } from "./insertion";
import { mdEditorMessages } from "../messages";
import MentionPicker from "../mentions/picker.vue";
import { useMdOverlayTarget } from "../overlays/context";
import type { SourceBlockSide } from "@quirekit/msfe-core";
import type { MdAdjacentInsertion } from "../blocks/insertion/types";
import { captureAdjacentInsertion } from "../blocks/insertion/adjacent";
import { adjacentInsertionLabels, insertionHint } from "../blocks/insertion/availability";
import { blockInsertionSource } from "../blocks/insertion/catalog";
import { createBlockInsertionWriter } from "../blocks/insertion/writer";
import InsertList from "../blocks/insertion/list.vue";
const portal = useMdOverlayTarget();

const props = defineProps<{
  /** Retained product source intent, public open state and execution bridge. */ scope: QuireKitToolbarRendererScope;
}>();
const context = computed(() => props.scope.context as MdToolbarContext);
const text = computed(() => mdEditorMessages[context.value.locale]);
const items = computed(() => { if (!props.scope.expanded) return []; void context.value.state; return insertionItems(context.value.editor, context.value.locale, toolbarInsertions); });
const adjacent = shallowRef<MdAdjacentInsertion | null>(null), handoff = ref(false);
const targets = computed(() => { void context.value.state; return { before: adjacent.value?.target("before"), after: adjacent.value?.target("after") }; });
const labels = computed(() => adjacentInsertionLabels(adjacent.value?.name ?? "", context.value.locale));
const hint = computed(() => !props.scope.expanded ? undefined : adjacent.value && !targets.value.before && !targets.value.after
  ? text.value.conflict : insertionHint(context.value.state, context.value.locale));
const recent = ref<string[]>([]), error = ref("");
watch([() => props.scope.expanded, () => context.value.anchor], ([open, anchor]) => {
  adjacent.value?.release(); adjacent.value = null; error.value = "";
  if (open) { handoff.value = false; adjacent.value = captureAdjacentInsertion(context.value.editor, anchor?.target() ?? undefined); }
}, { immediate: true });
onBeforeUnmount(() => adjacent.value?.release());
/** @param side - Explicit boundary beside the captured block. @param value - Installed insertion capability. */
function insertAdjacent(side: SourceBlockSide, value: string): void {
  const target = adjacent.value?.target(side);
  if (!target) { error.value = text.value.conflict; return; }
  const source = blockInsertionSource(context.value.editor, context.value.locale, value);
  if (source !== null) {
    const writer = createBlockInsertionWriter({ ...target, value });
    const accepted = writer?.commit(source); writer?.release();
    if (accepted) done(); else error.value = text.value.conflict;
  } else {
    handoff.value = true;
    context.value.insert({ ...target, value }); props.scope.setExpanded(false);
  }
}
/** @param action - Existing block/dialog intent; the toolbar routes it exactly once. */
function select(action: string): void { props.scope.execute(action); props.scope.setExpanded(false); }
/** End a completed insertion and restore the captured editor's focus after the public menu closes. */
function done(): void { props.scope.setExpanded(false); requestAnimationFrame(() => context.value.editor.focus()); }
/** @param item - Unicode value from the generic picker. */
function emoji(item: QuireKitEmojiItem): void {
  const target = context.value.anchor?.target();
  if (!target || !context.value.editor.run(insertMdText(item.value), target).ok) { error.value = text.value.conflict; return; }
  recent.value = [item.value, ...recent.value.filter(value => value !== item.value)].slice(0, 24); done();
}
/** @param value - Public calendar ISO value; no locale or time-zone conversion is persisted. */
function date(value: string | readonly string[] | null): void {
  if (typeof value !== "string") return;
  const target = context.value.anchor?.target();
  if (!target || !context.value.editor.run(insertMdDate(value), target).ok) { error.value = text.value.conflict; return; }
  done();
}
/** @returns Today's local calendar date, sampled only on an explicit user action. */
function today(): string {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
</script>
<template>
  <QuireMenu :portal-target="portal ?? 'body'" :open="scope.expanded" :aria-label="scope.item.label" width="264px" :close-on-select="false" :restore-focus="!handoff" @update:open="scope.setExpanded($event === true)">
    <template #trigger>
      <QuireToolbarDisclosure :toggle-on-click="false" :label="scope.item.label" :text="scope.item.label" indicator popup="menu"
        :expanded="scope.expanded" :disabled="scope.disabled" @update:expanded="scope.setExpanded">
        <QuireIcon name="insert" />
      </QuireToolbarDisclosure>
    </template>
    <p v-if="hint" role="status" class="m-0 p-qk-inline qk-type-helper text-qk-text-secondary">{{ hint }}</p>
    <template v-if="targets.before || targets.after">
      <QuireMenuSubmenu v-for="side in (['before', 'after'] as const)" :key="side" width="224px">
        <template #leading><QuireIcon :name="side === 'before' ? 'moveUp' : 'moveDown'" /></template>
        <template #trigger>{{ labels[side] }}</template>
        <InsertList v-if="targets[side]" :target="targets[side]!" :locale="context.locale" :mentions="!!context.mentions" @select="insertAdjacent(side, $event)" />
      </QuireMenuSubmenu>
      <QuireMenuSeparator />
    </template>
    <QuireMenuItems :items="items.slice(0, 1)" @select="select" />
    <QuireMenuSubmenu width="auto" :content-props="{ 'aria-label': text.date }">
      <template #trigger>{{ text.date }}</template><template #leading><QuireIcon name="calendarDays" /></template>
      <div @keydown.stop><QuireCalendar :label="text.date" density="compact" @update:model-value="date">
        <template #footer><QuireButton variant="ghost" size="sm" @click="date(today())">{{ text.today }}</QuireButton></template>
      </QuireCalendar></div>
    </QuireMenuSubmenu>
    <QuireMenuSubmenu width="auto" :content-props="{ 'aria-label': text.emoji }">
      <template #trigger>{{ text.emoji }}</template><template #leading><QuireIcon name="smile" /></template>
      <QuireEmojiPicker :recent="recent" autofocus @select="emoji" />
    </QuireMenuSubmenu>
    <QuireMenuSubmenu v-if="context.mentions" width="auto" :content-props="{ 'aria-label': text.mention }">
      <template #trigger>{{ text.mention }}</template><template #leading><QuireIcon name="atSign" /></template>
      <MentionPicker v-if="context.anchor" :editor="context.editor" :anchor="context.anchor" :source="context.mentions" :locale="context.locale" @inserted="done" />
    </QuireMenuSubmenu>
    <QuireMenuItem v-else value="mention" disabled :title="text.mentionUnavailable"><template #leading><QuireIcon name="atSign" /></template>{{ text.mention }}</QuireMenuItem>
    <QuireMenuItems :items="items.slice(1)" @select="select" />
    <p v-if="error" role="alert" class="px-qk-surface text-qk-helper">{{ error }}</p>
  </QuireMenu>
</template>
