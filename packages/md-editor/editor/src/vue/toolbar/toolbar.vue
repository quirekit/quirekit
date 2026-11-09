<script setup lang="ts">
import { computed, shallowRef, onBeforeUnmount, watch } from "vue";
import { QuireToolbar } from "@quirekit/ui/vue";
import type { QuireKitToolbarEntry, QuireKitToolbarExecuteEvent, QuireKitToolbarOpenChangeEvent } from "@quirekit/ui";
import type { MsfeEditor, MsfeTarget, SourceAnchor } from "@quirekit/msfe-core";
import type { EditorState } from "@quirekit/cm-state";
import type { MdEditorLocale, MdSelectionAction } from "../types";
import { mdEditorMessages } from "../messages";
import { toolbarItems } from "./configuration";
import { compactToolbarItems, readMdSelection, sameToolbarItems, selectionActionOf, selectionToolbarItems, useNarrowToolbar, withSelectionActions } from "./presentation";
import { dispatchChromeIntent } from "./intent";
import StyleField from "./style-field.vue";
import InsertionMenu from "./insertion-menu.vue";
import FileMenu from "../files/menu.vue";
import type { MdMentionSource } from "../../commands/types";
import type { MdToolbarContext } from "./types";
import type { MdDialogKind } from "../dialogs/types";
import type { MdFileMode } from "../files/types";
import type { MdExporter } from "../../export/types";
import type { MdBlockInsertionRequest } from "../blocks/insertion/types";
const props = defineProps<{
  /** Mounted source owner. */ editor: MsfeEditor;
  /** A hidden presentation computes only while retaining an open task. */ active?: boolean;
  /** Accepted state dependency; no document serialization. */ state: EditorState;
  /** Control language. */ locale: MdEditorLocale;
  /** Host contacts for mention insertion. */ mentions?: MdMentionSource | undefined;
  /** Host commands shown by the selection preset. */ selectionActions?: readonly MdSelectionAction[] | undefined;
  /** Whether Word file actions are enabled by the host. */ docx?: boolean;
  /** Host-installed export formats. */ exporters?: readonly MdExporter[];
  /** Optional library entry; absence leaves the base product unchanged. */ templateName?: string | undefined;
  /** Full fixed toolbar, or the compact floating selection toolbar. */ preset?: "full" | "selection";
}>();
const emit = defineEmits<{
  /** Open a source-anchored product editor. */ edit: [kind: MdDialogKind, target?: MsfeTarget, body?: string];
  /** Open a parameter task beside the original complete block. */ insert: [request: MdBlockInsertionRequest];
  /** Begin a document-level file action; format exports name the installed exporter. */ file: [mode: MdFileMode, exporter?: string];
  /** Request the host-installed template picker. */ template: [];
  /** A control's overlay opened or closed; floating hosts stay visible while it is open. */ expanded: [open: boolean];
  /** Open a comment draft for the selection. */ comment: [];
  /** Show the comment list. */ comments: [];
  /** Open a draft for a comment on the whole document. */ "document-comment": [];
  /** Focus the next (1) or previous (-1) comment. */ "comment-step": [direction: 1 | -1];
  /** Show the keyboard shortcut reference. */ shortcuts: [];
}>();
const text = computed(() => mdEditorMessages[props.locale]);
const historyRevision = shallowRef(0);
const feedback = shallowRef("");
watch(() => props.state, () => { feedback.value = ""; });
const target = shallowRef<SourceAnchor>();
watch(() => props.editor, (editor, _previous, cleanup) => {
  historyRevision.value++;
  cleanup(editor.history.subscribe(() => { historyRevision.value++; }));
}, { immediate: true });
const narrow = useNarrowToolbar(() => props.editor);
/** @returns Current controls; accepted transactions rebuild them. */
function buildItems(): readonly QuireKitToolbarEntry[] {
  void props.state; void historyRevision.value;
  if (props.active === false && !target.value) return [];
  const entries = toolbarItems(props.editor, props.locale, props.docx !== false, props.templateName, props.exporters);
  if (props.preset === "selection") return withSelectionActions(selectionToolbarItems(entries, props.editor.state.readOnly), props.selectionActions);
  return narrow.value ? compactToolbarItems(entries) : entries;
}
// Most keystrokes leave every control unchanged; keeping the previous list spares all of them a render.
const items = computed<readonly QuireKitToolbarEntry[]>(previous => {
  const next = buildItems();
  return previous && sameToolbarItems(previous, next) ? previous : next;
});
const context = computed<MdToolbarContext>(() => ({ editor: props.editor, get state() { return props.state; }, locale: props.locale, mentions: props.mentions, anchor: target.value, insert: request => emit("insert", request) }));
const renderers = { style: StyleField, insertion: InsertionMenu, files: FileMenu };
onBeforeUnmount(() => target.value?.release());
/** @param event - Capture a versioned selection before a public overlay takes focus. */
function open(event: QuireKitToolbarOpenChangeEvent): void {
  emit("expanded", event.expanded);
  if (event.expanded) { target.value?.release(); target.value = props.editor.captureAnchor(props.editor.state.selection.main); }
  else {
    const closing = target.value;
    queueMicrotask(() => { if (target.value === closing) { closing?.release(); target.value = undefined; } });
  }
}
/** @param event - Exactly one public Toolbar intent, guarded by MSFE command execution. */
function execute(event: QuireKitToolbarExecuteEvent): void {
  const { editor } = props;
  const value = event.source === "custom" && typeof event.payload === "string" ? event.payload : event.value;
  const selectionAction = selectionActionOf(value, props.selectionActions);
  if (selectionAction) { selectionAction.run(readMdSelection(editor.state)); return; }
  const captured = ["menu", "custom", "popup"].includes(event.source) ? target.value?.target() ?? undefined : undefined;
  if (["menu", "custom", "popup"].includes(event.source) && !captured) return;
  feedback.value = "";
  dispatchChromeIntent(editor, value, props.locale, captured, { feedback: message => { feedback.value = message; }, edit: (...args) => emit("edit", ...args), file: (...args) => emit("file", ...args), template: () => emit("template"), comment: () => emit("comment"), comments: () => emit("comments"), documentComment: () => emit("document-comment"), commentStep: direction => emit("comment-step", direction), shortcuts: () => emit("shortcuts") });
  target.value?.release(); target.value = undefined;
}
</script>
<template>
 <div data-qk-not-prose>
  <QuireToolbar :label="text.toolbar" :items="items" :context="context" :renderers="renderers" :variant="narrow && preset !== 'selection' ? 'plain' : 'elevated'" :align="narrow || preset === 'selection' ? 'start' : 'center'" :overflow="preset === 'selection' ? 'visible' : narrow ? 'collapse' : 'scroll'" preserve-focus :class="preset === 'selection' ? undefined : 'w-full'"
    data-qk-not-prose @execute="execute" @open-change="open" />
  <p v-if="feedback" role="status" class="m-0 p-qk-inline qk-type-helper text-qk-text-secondary" data-qk-not-prose>{{ feedback }}</p>
 </div>
</template>
