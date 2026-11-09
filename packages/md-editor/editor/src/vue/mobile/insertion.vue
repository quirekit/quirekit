<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { QuireTaskPanel, QuireActionDirectory, QuireCalendar, QuireEmojiPicker, QuireButton, QuireIcon } from "@quirekit/ui/vue";
import { isSafeDestination, type MsfeEditor, type MsfeTarget, type SourceAnchor, type SourceBlockSide } from "@quirekit/msfe-core";
import type { EditorState } from "@quirekit/cm-state";
import type { MdMentionSource } from "../../commands/types";
import { insertMdText, mdMentionSource } from "../../commands/portable";
import { insertMarkdownBlock } from "../../commands/insert";
import { mdDestinationSource } from "../../commands/destination";
import { blockInsertionItems, blockInsertionSource } from "../blocks/insertion/catalog";
import { createBlockInsertionWriter } from "../blocks/insertion/writer";
import { searchBlockInsertions } from "../blocks/insertion/search";
import type { MdBlockInsertionTarget, MdBlockInsertionWriter, MdBlockInsertionRequest, MdAdjacentInsertion } from "../blocks/insertion/types";
import { captureAdjacentInsertion } from "../blocks/insertion/adjacent";
import { adjacentInsertionLabels, insertionHint } from "../blocks/insertion/availability";
import { mobileInsertionDirectory, insertionIconTone } from "./catalog";
import DestinationFields from "../dialogs/destination-fields.vue";
import MentionPicker from "../mentions/picker.vue";
import { mdEditorMessages } from "../messages";
import type { MdEditorLocale } from "../types";
import { useMdOverlayTarget } from "../overlays/context";
const props = defineProps<{
  /** Original source owner. */ editor: MsfeEditor;
  /** Accepted immutable state for capability and conflict checks. */ state: EditorState;
  /** One product task request. */ open: boolean;
  /** Public control language. */ locale: MdEditorLocale;
  /** Real task opening element. */ anchorEl?: (() => HTMLElement | null) | undefined;
  /** Original block boundary for empty-line and adjacent insertions. */ target?: MdBlockInsertionTarget | undefined;
  /** Optional host mention capability. */ mentions?: MdMentionSource | undefined;
  /** Explicit initial page for the dock's image shortcut. */ initial?: string | undefined;
}>();
const emit = defineEmits<{
  /** Ends this unchanged or successfully committed task. */ "update:open": [value: boolean];
  /** Delegates an existing large workspace at the retained text target. */ action: [value: string, target: MsfeTarget];
  /** Delegates a large workspace at the retained block boundary. */ insert: [request: MdBlockInsertionRequest];
  /** Physical shell used by the document's scroll-margin owner. */ surface: [element: HTMLElement | null];
}>();
const text = computed(() => mdEditorMessages[props.locale]), portal = useMdOverlayTarget();
const page = ref(""), query = ref(""), url = ref(""), label = ref(""), title = ref(""), error = ref("");
const anchor = shallowRef<SourceAnchor>();
const adjacent = shallowRef<MdAdjacentInsertion | null>(null), side = ref<SourceBlockSide | "">("");
const task = ref<InstanceType<typeof QuireTaskPanel>>(), completed = ref(false), handoff = ref(false);
let writer: MdBlockInsertionWriter | null = null, scope = props.editor.documentScope;
let pendingTask: (() => void) | undefined;
const catalog = computed(() => { void props.state; return props.open ? blockInsertionItems(props.editor, props.locale, !!props.mentions, !props.target && !side.value) : []; });
const actions = computed(() => mobileInsertionDirectory(catalog.value));
const matches = computed(() => new Set(searchBlockInsertions(catalog.value, query.value).map(item => item.key)));
const labels = computed(() => adjacentInsertionLabels(adjacent.value?.name ?? "", props.locale));
const adjacentReady = computed(() => { void props.state; return !!adjacent.value?.target("before"); });
const hint = computed(() => !props.open || props.target || side.value ? undefined
  : adjacent.value && !adjacentReady.value ? text.value.conflict : insertionHint(props.state, props.locale));
const heading = computed(() => page.value ? text.value[page.value as "image"] : side.value ? labels.value[side.value] : text.value.insert);
watch(() => props.open, open => {
  release(); error.value = "";
  if (!open) return;
  pendingTask = undefined;
  scope = props.editor.documentScope; completed.value = false; handoff.value = false; page.value = props.initial ?? ""; side.value = ""; query.value = ""; url.value = ""; label.value = ""; title.value = "";
  writer = props.target ? createBlockInsertionWriter({ ...props.target, value: "" }) : null;
  anchor.value = props.target ? writer?.anchor : props.editor.captureAnchor(props.editor.state.selection.main);
  if (!props.target) adjacent.value = captureAdjacentInsertion(props.editor, anchor.value?.target() ?? undefined);
}, { immediate: true, flush: "sync" });
watch(() => props.state, () => { if (props.open && (scope !== props.editor.documentScope || props.editor.state.readOnly || props.editor.mode === "locked")) emit("update:open", false); });
onBeforeUnmount(() => { pendingTask = undefined; release(); });
/** Releases captured source intent; never writes placeholders. */
function release(): void { writer?.release(); writer = null; anchor.value?.release(); anchor.value = undefined; adjacent.value?.release(); adjacent.value = null; }
/** @param value - User-selected boundary beside the original complete block. */
function chooseSide(value: SourceBlockSide): void {
  const target = adjacent.value?.target(value);
  if (!target) { error.value = text.value.conflict; return; }
  const next = createBlockInsertionWriter({ ...target, value: "" });
  if (!next) { error.value = text.value.conflict; return; }
  writer?.release(); writer = next; side.value = value; query.value = ""; error.value = "";
}
/** Returns one task level without creating or moving source content. */
function back(): void {
  if (page.value) page.value = "";
  else { writer?.release(); writer = null; side.value = ""; }
  query.value = ""; error.value = "";
}
/** @param value - Canonical directory action. @param _query - Directory query, already consumed once by the shared search. @returns Installed matching action. */
function filter(value: { value: string }, _query: string): boolean { return matches.value.has(value.value); }
/** @param source - Canonical feature source. @param block - Whether a free text selection needs block separators. @returns Accepted single source transaction. */
function commit(source: string, block = false): boolean {
  const target = writer ? writer.anchor.target() : anchor.value?.target();
  if (!target || scope !== props.editor.documentScope || props.editor.state.readOnly || props.editor.mode === "locked") { error.value = text.value.conflict; return false; }
  const ok = writer ? writer.commit(source) : props.editor.run(block ? insertMarkdownBlock(source) : insertMdText(source), target).ok;
  if (!ok) { error.value = text.value.rejected; return false; }
  completed.value = true; task.value?.requestClose("action"); return true;
}
/** @param value - Live installed action, checked again at the submission boundary. */
function activate(value: string): void {
  if (!actions.value.some(action => action.value === value && !action.disabled)) return;
  if (["date", "emoji", "mention", "image"].includes(value)) { page.value = value; error.value = ""; return; }
  const source = blockInsertionSource(props.editor, props.locale, value);
  if (source !== null) { commit(source, true); return; }
  const target = writer ? writer.anchor.target() : anchor.value?.target();
  if (!target || scope !== props.editor.documentScope) { error.value = text.value.conflict; return; }
  const boundary = side.value ? adjacent.value?.target(side.value) : props.target;
  if (side.value && !boundary) { error.value = text.value.conflict; return; }
  handoff.value = true;
  if (value === "link") {
    // The closing animation still owns a dismissable layer. Wait for its public
    // physical release before mounting another modal, preserving the source target.
    const lifetime = scope;
    pendingTask = () => {
      if (props.open || !handoff.value || props.editor.scope.disposed || lifetime !== props.editor.documentScope) return;
      if (boundary) emit("insert", { ...boundary, value }); else emit("action", value, target);
    };
    task.value?.requestClose("action");
    return;
  }
  if (boundary) emit("insert", { ...boundary, value }); else emit("action", value, target);
  task.value?.requestClose("action");
}
/** @param element - Physical shell ownership, including its complete exit animation. */
function surfaceChanged(element: HTMLElement | null): void {
  emit("surface", element);
  if (element || !pendingTask) return;
  const next = pendingTask; pendingTask = undefined;
  void nextTick(next);
}
/** Validates portable destination fields before one guarded write. */
function destination(): void {
  const image = page.value === "image", address = url.value.trim();
  if (!address || !isSafeDestination(address, image)) { error.value = text.value.invalidUrl; return; }
  const source = mdDestinationSource(image, { url: address, label: label.value, title: title.value });
  // Destinations use inline Markdown at a caret; an explicit block writer still
  // owns separators when this task was opened before or after a complete block.
  if (source) commit(source);
}
/** @param value - Public calendar date. */
function date(value: string | readonly string[] | null): void { if (typeof value === "string") commit(value); }
/** @returns Current source after a commit, otherwise the actual opening button. */
function finalFocus(): HTMLElement | null {
  const content = props.editor.element.querySelector<HTMLElement>('[contenteditable=true]');
  const entry = props.anchorEl?.();
  return completed.value ? content : entry?.matches("button") ? entry : entry?.querySelector("button") ?? content;
}
</script>
<template>
  <QuireTaskPanel ref="task" :open="open" :title="heading" presentation="bottom" max-height="min(76dvh, 640px)" :anchor-el="anchorEl ?? (() => editor.element)" :portal-target="portal" :can-go-back="!!page || !!side"
    :restore-focus="!handoff" :final-focus-el="finalFocus" @content-element-change="surfaceChanged" @update:open="emit('update:open', $event)" @back="back">
    <template v-if="!page && !side">
      <p v-if="hint" role="status" class="m-0 mb-qk-inline qk-type-helper text-qk-text-secondary">{{ hint }}</p>
      <div v-if="adjacentReady" class="md-insertion-boundaries">
        <QuireButton v-for="location in (['before', 'after'] as const)" :key="location" variant="outline" class="md-insertion-boundary" @click="chooseSide(location)">
          <QuireIcon :name="location === 'before' ? 'moveUp' : 'moveDown'" />{{ labels[location] }}
        </QuireButton>
      </div>
    </template>
    <div v-show="!page" data-md-mobile-directory><QuireActionDirectory v-model:query="query" :actions="actions" layout="grid" searchable :search-placeholder="text.insertionSearch" :filter="filter" @activate="activate"><template #icon="{ action }"><QuireIcon v-if="action.icon" :name="action.icon" :size="20" :class="`md-insertion-icon--${insertionIconTone(action.value)}`" /></template></QuireActionDirectory></div>
    <QuireCalendar v-if="page === 'date'" :label="text.date" @update:model-value="date" />
    <QuireEmojiPicker v-else-if="page === 'emoji'" @select="commit($event.value)" />
    <MentionPicker v-else-if="page === 'mention' && mentions && anchor" :editor="editor" :anchor="anchor" :source="mentions" :locale="locale" :insert="item => { const source = mdMentionSource(item); return !!source && commit(source); }" />
    <DestinationFields v-else-if="page === 'image'" v-model:url="url" v-model:label="label" v-model:title="title" :image="true" :locale="locale" />
    <p v-if="error" role="alert" class="text-qk-danger-text">{{ error }}</p>
    <template v-if="page === 'image'" #footer><QuireButton color="primary" @click="destination">{{ text.confirm }}</QuireButton></template>
  </QuireTaskPanel>
</template>

<style scoped>
.md-insertion-boundaries { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--qk-space-inline); margin-bottom: var(--qk-space-inline); }
.md-insertion-boundary { min-height: 44px; white-space: normal; }
.md-insertion-icon--media { color: var(--qk-color-success-text); }
.md-insertion-icon--warning { color: var(--qk-color-warning-text); }
.md-insertion-icon--accent { color: var(--qk-color-text-accent); }
.md-insertion-icon--diagram { color: var(--qk-color-info-text); }
.md-insertion-icon--neutral { color: var(--qk-color-text-secondary); }
</style>
