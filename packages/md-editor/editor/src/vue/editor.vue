<script setup lang="ts">
import "katex/dist/katex.min.css";
import "@quirekit/whiteboard-editor/styles.css";
import { computed, nextTick, provide, shallowRef, useSlots, watch } from "vue";
import type { ExportTemplateReference } from '@quirekit/export-template';
import { useExportTemplateSelection } from './templates/selection';
import { useMsfeEditor, VueComponentViewRenderer, VueNodeViewHost } from "@quirekit/msfe-vue";
import SearchPanel from "./search/panel.vue";
import { mdSearchKeymap } from "./search/mode";
import { QuireAlert, QuireIcon, QuireIconButton, QuireLocaleProvider, QuireProseSource, useQuireKitTheme } from "@quirekit/ui/vue";
import { bindMdDialogTheme } from "./dialog-theme";
import type { MsfeChangeEvent, MsfeTarget, SearchPanelProps } from "@quirekit/msfe-core";
import { createSourceBlockControls, type SourceBlockControls, type SourceInsertionControls } from "@quirekit/msfe-core";
import BlockSurface from "./blocks/surface.vue";
import OverlayHost from "./overlays/host.vue";
import DocumentLayer from "./overlays/layer.vue";
import { provideMdDocumentLayer, provideMdOverlayTarget } from "./overlays/context";
import BlockInsert from "./blocks/insertion/editor.vue";
import EmptyInsert from "./blocks/insertion/surface.vue";
import type { MdBlockInsertionRequest } from "./blocks/insertion/types";
import { EditorSelection, type EditorState } from "@quirekit/cm-state";
import { mdEditorKey, mdLocaleKey, mdNarrowKey, mdImageEditKey, mdPreviewEditKey } from "./context";
import type { PreviewEditRequest } from "@quirekit/msfe-markdown-extras";
import { mdEditorMessages } from "./messages";
import { vueMdEditorExtensions } from "./extensions";
import { mdCodeLanguages } from "../code/languages";
import { documentViewport } from "./viewport";
import { createMdDocumentLinkTrigger, createMdMentionTrigger } from "./mentions/trigger";
import MentionSurface from "./mentions/surface.vue";
import TextLinkCard from "./text-links/card.vue";
import LinkContext from "./links/card.vue";
import DocumentPreview from "./document-links/preview.vue";
import { withDocumentReferences } from "./document-links/features";
import ObjectSurface from "./objects/surface.vue";
import { placeholder } from "@quirekit/cm-view";
import { linePlaceholders } from "../presentation/placeholder";
import { withMdImageStorage } from "../images/docx";
import type { MdMentionSession } from "./mentions/types";
import { createMdSlashTrigger } from "./slash/trigger";
import SlashSurface from "./slash/surface.vue";
import type { MdSlashSession } from "./slash/types";
import type { MdEditorProps } from "./types";
import type { MdEditableView, MdEditorView } from "../types";
import MdProse from "./prose.vue";
import { mdReadingComponents } from "./reading/components";
import Toolbar from "./toolbar/toolbar.vue";
import FloatingToolbar from "./toolbar/floating.vue";
import MobileDock from "./mobile/dock.vue";
import MobileSelection from "./mobile/selection.vue";
import { useRetainedSelection } from "./selection/retained";
import { useNarrowToolbar } from "./toolbar/presentation";
import OutlinePanel from "./outline/panel.vue";
import OutlineToggle from "./outline/toggle.vue";
import { useOutlineLayout } from "./outline/layout";
import { railStyle } from "./outline/rails";
import { useMdOutline } from "./outline/use-outline";
import { setMdView } from "../presentation/mode";
import DialogEditor from "./dialogs/editor.vue";
import ShortcutsDialog from "./shortcuts/dialog.vue";
import { mdShortcutKeymap } from "./shortcuts/keymap";
import { dispatchChromeIntent } from "./toolbar/intent";
import { createDialogIntent } from "./dialogs/intent";
import type { MdDialogIntent, MdDialogKind } from "./dialogs/types";
import FileDialog from "./files/dialog.vue";
import { createFileIntent } from "./files/intent";
import type { MdFileIntent, MdFileMode } from "./files/types";
import { resolveMdMentions } from "./mentions/provider";
import PanelHost from "./panels/host.vue";
import { setMdDocumentTitle } from "./files/name";
import { setMdImageStorage } from "../images/diagram";
const props = withDefaults(defineProps<MdEditorProps>(), {
  locale: "zh-CN", readOnly: false, toolbar: true, blockControls: true, slashMenu: true, view: "document", layout: "embedded", outline: false, selectionToolbar: true, outlinePosition: "start",
  // Vue casts an absent Boolean-union prop to false; omission must keep containers installed.
  /** @returns Explicit default options, distinct from disabling the feature. */
  containers: () => ({}),
  /** @returns Enabled product extras rather than Vue's absent-Boolean coercion. */
  extras: () => ({}),
});
const emit = defineEmits<{
  /** Incremental source change; persist by reading only when needed. */ change: [event: MsfeChangeEvent];
  /** Original creation or runtime error for host diagnostics. */ error: [error: unknown];
  /** Persist the template reference alongside the host document, outside Markdown and history. */ "update:exportStyle": [reference: ExportTemplateReference];
  /** The view shortcut asks for the next view; bind with `v-model:view` to let it switch. */ "update:view": [view: MdEditorView];
}>();
const slots = useSlots(), libraryOpen = shallowRef(false), shortcutsOpen = shallowRef(false);
const exportTemplate = useExportTemplateSelection(props, reference => emit('update:exportStyle', reference));
const hasTemplatePicker = computed(() => !!props.templates && !!slots['export-templates']);
/** Conversion policy without the converter, shared by Word files and format exporters. */
const filePolicy = computed(() => {
  const { converter, ...policy } = props.docx || { converter: undefined };
  void converter;
  return withMdImageStorage(policy, props.images);
});
const parent = shallowRef<HTMLElement | null>(null), state = shallowRef<EditorState>();
const toolbarElement = shallowRef<HTMLElement | null>(null), root = shallowRef<HTMLElement | null>(null);
const mobileDock = shallowRef<InstanceType<typeof MobileDock>>(), narrow = shallowRef(false);
const mobileSelection = shallowRef<InstanceType<typeof MobileSelection>>();
const intent = shallowRef<MdDialogIntent>();
const linkContextOpen = shallowRef(false);
const file = shallowRef<MdFileIntent>();
const mention = shallowRef<MdMentionSession>();
const blockControls = shallowRef<SourceBlockControls | null>(null);
const blockMenu = shallowRef(false);
const emptyControls = shallowRef<SourceInsertionControls | null>(null), emptyMenu = shallowRef(false);
const overlayTarget = provideMdOverlayTarget(), documentLayer = provideMdDocumentLayer();
/** @returns Height of the sticky toolbar that document-layer surfaces dock beneath. */
function stickyTop(): number {
  const toolbar = toolbarElement.value;
  if (!toolbar || toolbarMode.value !== "fixed" || narrow.value || props.layout !== "document") return 0;
  return (Number.parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.offsetHeight;
}
const blockInsert = shallowRef<MdBlockInsertionRequest>();
const slashSession = shallowRef<MdSlashSession | null>(null), slashSurface = shallowRef<InstanceType<typeof SlashSurface>>();
const slash = createMdSlashTrigger({
  enabled: () => props.slashMenu && !narrow.value && !intent.value && !file.value && !mention.value && !blockInsert.value && !libraryOpen.value && !blockMenu.value && !emptyMenu.value,
  change: session => { slashSession.value = session; }, keydown: event => slashSurface.value?.handleKeydown(event) ?? false,
});
const failed = shallowRef(false);
const toolbarMode = computed(() => props.toolbar === false ? "none" : props.toolbar === "floating" ? "floating" : "fixed");
const text = computed(() => mdEditorMessages[props.locale]);
/** Comment workspace installed by the host; read once on mount. */
const commentPlugin = props.comments || null;
const reading = computed(() => props.view === "reading");
// The editor keeps its last editable view while the reading view renders the same state, so selection and history survive.
const editableView = shallowRef<MdEditableView>(props.view === "reading" ? "document" : props.view);
watch(() => props.view, value => { if (value !== "reading") editableView.value = value; });
const { editor, host } = useMsfeEditor(parent, () => ({
  ...(props.markdown === undefined ? {} : { markdown: props.markdown }), mode: editableView.value === "source" ? "source" : "live", readOnly: props.readOnly, label: props.label ?? text.value.editor,
  searchPanel: VueComponentViewRenderer<SearchPanelProps>(SearchPanel),
  extensions: vueMdEditorExtensions(props.locale, {
    ...(props.inlineBoundaries ? { inlineBoundaries: props.inlineBoundaries } : {}),
    ...(props.editingBoundaries ? { editingBoundaries: props.editingBoundaries } : {}),
    view: editableView.value,
    ...(props.imageSource ? { imageSource: props.imageSource } : {}),
    ...(props.images ? { images: props.images } : {}),
    ...(props.features || props.documentLinks?.recognize ? { features: withDocumentReferences(props.features, props.documentLinks) } : {}),
    ...(props.containers === undefined ? {} : { containers: props.containers }),
    ...(props.extras === undefined ? {} : { extras: props.extras }),
    extensions: [documentViewport(() => toolbarElement.value, () => mobileDock.value?.getElement() ?? null, () => mobileSelection.value?.getTaskElement() ?? mobileDock.value?.getTaskElement() ?? null),
      { id: "md-shortcuts", extensions: mdShortcutKeymap(runShortcut) },
      { id: "md-search", extensions: mdSearchKeymap },
      slash.extension, ...(props.readOnly || props.placeholder === "" ? [] : [{ id: "md-placeholder", extensions: [placeholder(props.placeholder ?? text.value.placeholder), linePlaceholders(text.value.linePlaceholder)] }]), ...(props.extensions ?? []), ...(props.blockControls ? [createSourceBlockControls({
      change: value => { blockControls.value = value; if (!value || value.dragging) blockMenu.value = false; },
      openMenu: value => { blockControls.value = value; blockMenu.value = true; },
      insertionChange: value => { emptyControls.value = value; if (!value) emptyMenu.value = false; },
      openInsertionMenu: value => { emptyControls.value = value; emptyMenu.value = true; },
    })] : []), ...(commentPlugin ? commentPlugin.extensions({ locale: props.locale, openDraft: openCommentDraft }) : []), ...(props.mentions ? [createMdMentionTrigger(request => {
      if (!props.mentions || intent.value || file.value || mention.value || blockInsert.value) return;
      mention.value = { anchor: request.editor.captureAnchor(request.range), point: { x: request.x, y: request.y } };
    })] : []), ...(props.documentLinks ? [createMdDocumentLinkTrigger(request => {
      if (!props.documentLinks || intent.value || file.value || mention.value || blockInsert.value) return;
      mention.value = { anchor: request.editor.captureAnchor(request.range), point: { x: request.x, y: request.y }, kind: "document" };
    })] : [])],
  }, openPreviewEditor),
  codeLanguages: props.codeLanguages ?? mdCodeLanguages, onChange: event => emit("change", event),
  onError: error => { failed.value = true; emit("error", error); },
}));
/** @param id - Documented toolbar intent. @returns Whether the key ran it through the same entry as the toolbar button. */
function runShortcut(id: string): boolean {
  const owner = editor.value;
  if (!owner) return false;
  if (id === "shortcuts") { shortcutsOpen.value = true; return true; }
  if (owner.state.readOnly) return false;
  dispatchChromeIntent(owner, id, props.locale, owner.captureTarget(), { edit, file: openFile, template: () => { libraryOpen.value = true; } });
  return true;
}
/** @param request - Validated formula or text-diagram source. @returns Whether the source dialog opened. */
function openPreviewEditor(request: PreviewEditRequest): boolean {
  if (intent.value || file.value || blockInsert.value) return false;
  const target = { ...request.editor.captureTarget(), selection: EditorSelection.single(request.range.from, request.range.to) };
  const next = createDialogIntent(request.editor, request.kind, target);
  if (!next) return false;
  intent.value = next; return true;
}
useNarrowToolbar(() => editor.value, narrow);
// Downloads are named after the host title; the accessible fallback label is not a document title.
watch([editor, () => props.label], ([owner, label]) => { if (owner) setMdDocumentTitle(owner, label); }, { immediate: true });
watch([editor, () => props.images], ([owner, images]) => { if (owner) setMdImageStorage(owner, images); }, { immediate: true });
/** Host contacts as the comment field's @ lookup. */
const commentMentions = computed(() => {
  const source = props.mentions;
  return source ? (query: string) => resolveMdMentions(source, { query, signal: new AbortController().signal }) : undefined;
});
const comments = commentPlugin?.setup({ editor: () => editor.value ?? undefined, state: () => state.value, root,
  wide: () => props.layout === "document" && !narrow.value, narrow: () => narrow.value, reading: () => reading.value, locale: () => props.locale, mentions: () => commentMentions.value }) ?? null;
const linkContextEnabled = computed(() => !intent.value && !file.value && !mention.value && !blockInsert.value && !libraryOpen.value
  && !blockMenu.value && !emptyMenu.value && !slashSession.value && !comments?.drafting.value && !mobileDock.value?.active);
/** @returns Whether a comment draft opened for the selection; also bound to Mod-Alt-M. */
function openCommentDraft(): boolean { return comments?.openDraft() ?? false; }
const outlineOpen = shallowRef(false);
const outlineLayout = useOutlineLayout(root, toolbarElement, () => props.outline && props.layout === "document" && !narrow.value, () => comments?.layout.value === "side");
const outlinePresented = computed(() => outlineLayout.mode.value === "side" || outlineLayout.mode.value === "toggle" && outlineOpen.value);
const outline = useMdOutline({ editor: () => editor.value ?? undefined, state: () => state.value, presented: () => outlinePresented.value,
  untitled: () => text.value.untitledHeading, readingLine: outlineLayout.readingLine });
/** @param id - Heading chosen in the outline popover. */
function navigateOutline(id: string): void { outline.navigate(id); outlineOpen.value = false; }
/** Pins the collapsed outline back beside the document. */
function expandOutline(): void { outlineLayout.collapsed.value = false; }
// Host panels, such as an assistant, dock at the document's end; one is open at a time.
const openPanel = shallowRef<string | null>(props.panels?.find(panel => panel.defaultOpen)?.id ?? null);
/** @param id - Panel to show, or the open one to hide. */
function togglePanel(id: string): void { openPanel.value = openPanel.value === id ? null : id; }
// With a fixed toolbar the collapsed outline control sits in the toolbar row, so the document keeps no column for it.
const outlineInToolbar = computed(() => outlineLayout.mode.value === "toggle" && toolbarMode.value === "fixed" && !narrow.value);
const outlineLabels = computed(() => ({ outline: text.value.outline, expand: text.value.expandOutline, empty: text.value.emptyOutline }));
const rails = computed(() => railStyle({ blockControls: props.blockControls, outline: outlineInToolbar.value ? "none" : outlineLayout.mode.value, outlinePosition: props.outlinePosition,
  comments: comments?.layout.value === "side", toolbarHeight: outlineLayout.toolbarHeight.value }));
provide(mdEditorKey, editor);
provide(mdNarrowKey, narrow);
provide(mdLocaleKey, computed(() => props.locale));
provide(mdPreviewEditKey, openPreviewEditor);
provide(mdImageEditKey, range => {
  if (editor.value) edit("image", { ...editor.value.captureTarget(), selection: EditorSelection.single(range.from, range.to) });
});
useRetainedSelection(editor, state);
// Dialogs (data view, whiteboard, flowchart, mind map) mount their own app; they read the host theme through the editor element.
const hostTheme = useQuireKitTheme();
watch(editor, (value, _previous, cleanup) => {
  if (!value) return;
  bindMdDialogTheme(value.element, () => hostTheme?.value);
  state.value = value.state;
  let lifetime = value.documentScope;
  // Bounded immutable references drive toolbar state; no per-keystroke Markdown string.
  cleanup(value.subscribeState({ select: next => next, change: next => {
    if (lifetime !== value.documentScope) { lifetime = value.documentScope; file.value = undefined; intent.value = undefined; mention.value = undefined; blockInsert.value = undefined; libraryOpen.value = false; exportTemplate.reset(); }
    state.value = next;
  } }));
  // Start with a calm document presentation; focus is only taken after a user action.
  value.setSelection(EditorSelection.single(value.state.doc.length));
}, { immediate: true });
watch([editableView, () => props.readOnly] as const, ([view, readOnly]) => { if (editor.value) setMdView(editor.value, view, readOnly); });
const reader = shallowRef<HTMLElement | null>(null);
// A view switch, from the shortcut or the host's own control, leaves the keyboard in the document.
// A host control can still take focus after the switch (WebKit applies it late), so the next frame retries once.
watch(() => props.view, value => {
  const focus = () => value === "reading" ? reader.value?.focus({ preventScroll: true }) : editor.value?.focus();
  const focused = () => !!root.value?.contains(document.activeElement);
  void nextTick(() => { focus(); requestAnimationFrame(() => { if (!focused()) focus(); }); });
});
const views: readonly MdEditorView[] = ["document", "preview", "source", "reading"];
/** @param event - Key press anywhere in the editor; Mod-Alt-V steps to the next view, the reading view included. */
function switchView(event: KeyboardEvent): void {
  const mac = /Mac|iPhone|iPad/u.test(navigator.platform);
  if (event.code !== "KeyV" || !event.altKey || event.shiftKey || (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) || event.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  emit("update:view", views[(views.indexOf(props.view) + 1) % views.length]!);
}
watch(() => props.mentions, source => { if (!source) mention.value = undefined; });
watch(() => [props.slashMenu && !narrow.value, intent.value, file.value, mention.value, blockInsert.value, libraryOpen.value, blockMenu.value, emptyMenu.value] as const,
  ([enabled, ...busy]) => { if (!enabled || busy.some(Boolean)) slash.dismiss(); });
/** @param kind - Explicit toolbar dialog. @param target - Captured source intent. @param body - Optional diagram template. @returns Whether the shared task accepted this opening. */
function edit(kind: MdDialogKind, target?: MsfeTarget, body?: string): boolean {
  if (!editor.value || intent.value || file.value || mention.value || blockInsert.value || kind === "link" && !Object.hasOwn(editor.value.storage, "link")) return false;
  intent.value = createDialogIntent(editor.value, kind, target, body) ?? undefined;
  return !!intent.value;
}
/** @param mode - Explicit document import or snapshot export. @param id - Installed exporter for a format export. */
function openFile(mode: MdFileMode, id?: string): void {
  if (!editor.value || intent.value || file.value || mention.value || blockInsert.value) return;
  const exporter = mode === 'formatExport' ? props.exporters?.find(item => item.id === id) : undefined;
  if (mode === 'formatExport' ? !exporter : mode !== 'markdownImport' && !props.docx) return;
  const next = createFileIntent(editor.value, mode);
  file.value = next ? { ...next, ...(exporter ? { exporter } : {}), ...((mode === 'wordExport' || exporter) && props.templates ? {
    templateReference: { ...exportTemplate.selected.value }, templateProvider: props.templates,
  } : {}) } : undefined;
}
/** @param reference - Explicit selection from the host's picker. */
function chooseExportTemplate(reference: ExportTemplateReference): void {
  exportTemplate.choose(reference); libraryOpen.value = false;
  if ((file.value?.mode === 'wordExport' || file.value?.mode === 'formatExport') && props.templates) file.value = { ...file.value, templateReference: { ...reference }, templateProvider: props.templates };
}
defineExpose({ editor, openFile, showComments: () => comments?.showList(), setCommentRailVisible: (visible: boolean) => comments?.setRailVisible(visible) });
</script>
<template>
  <QuireLocaleProvider :locale="locale">
  <div ref="root" :lang="locale" class="md-editor min-w-0 bg-qk-surface-page" @keydown.capture="switchView" :data-layout="layout" :data-block-controls="props.blockControls"
    :data-outline="outlineLayout.mode.value === 'none' ? undefined : outlineLayout.mode.value" :data-comments="comments?.layout.value === 'side' ? 'side' : undefined" :data-rails="rails ? '' : undefined"
    :data-outline-position="outlineLayout.mode.value === 'none' ? undefined : props.outlinePosition" :data-panel-open="openPanel ?? undefined" :style="rails">
    <div v-if="toolbarMode === 'fixed' && editor && state && !reading" v-show="!narrow" ref="toolbarElement" class="md-editor__toolbar">
      <div v-if="outlineInToolbar && props.outlinePosition === 'start'" class="md-editor__toolbar-start">
        <OutlineToggle v-model:open="outlineOpen" :pinnable="outlineLayout.pinnable.value" placement="bottom-start" :tree="outline.tree.value"
          :active="outline.active.value" :labels="outlineLabels" @expand="expandOutline" @navigate="navigateOutline" />
      </div>
      <Toolbar class="md-editor__toolbar-main" :active="!narrow" :editor="editor" :state="state" :locale="locale" :mentions="mentions" :docx="!!docx" :exporters="props.exporters ?? []"
        :template-name="hasTemplatePicker ? exportTemplate.name.value : undefined" @template="libraryOpen = true" @edit="edit" @file="openFile" @insert="blockInsert = $event"
        @comment="openCommentDraft" @comments="comments?.showList()" @comment-step="comments?.step($event)" @document-comment="comments?.openDocumentDraft()" @shortcuts="shortcutsOpen = true" />
      <div v-if="props.panels?.length || outlineInToolbar && props.outlinePosition === 'end'" class="md-editor__panel-toggles">
        <OutlineToggle v-if="outlineInToolbar && props.outlinePosition === 'end'" v-model:open="outlineOpen" :pinnable="outlineLayout.pinnable.value" placement="bottom-end"
          :tree="outline.tree.value" :active="outline.active.value" :labels="outlineLabels" @expand="expandOutline" @navigate="navigateOutline" />
        <QuireIconButton v-for="panel in props.panels ?? []" :key="panel.id" :label="panel.label[locale]" :aria-pressed="openPanel === panel.id" size="sm"
          :variant="openPanel === panel.id ? 'soft' : 'ghost'" @click="togglePanel(panel.id)"><QuireIcon :name="panel.icon" :size="16" /></QuireIconButton>
      </div>
    </div>
    <div v-if="failed" class="md-editor__document md-editor__error grid min-w-0 gap-qk-group p-qk-group">
      <QuireAlert color="danger" role="alert" :title="editor ? text.editorError : text.editorStartError"
        :description="editor ? text.editorErrorHint : text.editorStartErrorHint" :closable="!!editor"
        @close="failed = false; editor?.focus()" />
      <QuireProseSource v-if="!editor" :code="markdown" language="markdown" filename="document.md" />
    </div>
    <div v-if="slots.header" class="md-editor__document md-editor__header"><slot name="header" /></div>
    <div v-show="!reading" ref="parent" class="md-editor__document" :data-has-header="!!slots.header || undefined" :data-has-footer="!!slots.footer || undefined" />
    <div v-if="reading && state" ref="reader" tabindex="-1" class="md-editor__document md-editor__reading outline-none" data-md-reading><MdProse :state="state" :locale="locale" :components="mdReadingComponents" /></div>
    <div v-if="slots.footer" class="md-editor__document md-editor__footer"><slot name="footer" /></div>
    <component :is="comments.documentSection" v-if="comments?.documentSection && !reading" class="md-editor__document" />
    <aside v-if="editor && outlineLayout.mode.value !== 'none' && !outlineInToolbar" class="md-editor__outline" :aria-label="text.outline">
      <div class="md-editor__outline-sticky">
        <template v-if="outlineLayout.mode.value === 'side'">
          <div class="md-editor__outline-title">
            <span aria-hidden="true">{{ text.outline }}</span>
            <QuireIconButton :label="text.collapseOutline" size="sm" variant="ghost" @click="outlineLayout.collapsed.value = true">
              <QuireIcon :name="props.outlinePosition === 'start' ? 'panelLeftClose' : 'panelRightClose'" :size="16" />
            </QuireIconButton>
          </div>
          <OutlinePanel :tree="outline.tree.value" :active="outline.active.value" :label="text.outline" :empty="text.emptyOutline" @navigate="outline.navigate" />
        </template>
        <OutlineToggle v-else v-model:open="outlineOpen" :pinnable="outlineLayout.pinnable.value" :placement="props.outlinePosition === 'start' ? 'bottom-start' : 'bottom-end'"
          :tree="outline.tree.value" :active="outline.active.value" :labels="outlineLabels" @expand="expandOutline" @navigate="navigateOutline" />
      </div>
    </aside>
    <aside v-if="comments && comments.layout.value === 'side' && !reading" class="md-editor__comments" :aria-label="text.comments">
      <component :is="comments.rail" />
    </aside>
    <component :is="comments.list" v-if="comments" />
    <template v-if="editor">
      <PanelHost v-for="panel in props.panels ?? []" :key="panel.id" :panel="panel" :editor="editor" :locale="locale" :open="openPanel === panel.id" @close="openPanel = null" />
    </template>
    <div v-if="editor && narrow && props.panels?.length && openPanel === null" class="md-editor__panel-fab">
      <QuireIconButton v-for="panel in props.panels" :key="panel.id" :label="panel.label[locale]" variant="solid" size="lg" @click="togglePanel(panel.id)"><QuireIcon :name="panel.icon" :size="20" /></QuireIconButton>
    </div>
    <VueNodeViewHost :host="host" />
    <MobileSelection v-if="editor && state && !reading" ref="mobileSelection" :editor="editor" :state="state" :locale="locale" :root="root" :fixed="layout === 'document'" :enabled="narrow && !intent && !file && !mention && !blockInsert && !libraryOpen && !blockMenu && !emptyMenu && !mobileDock?.active"
      :commentable="!!comments?.writable.value" @comment="openCommentDraft" />
    <FloatingToolbar v-if="(toolbarMode === 'floating' || toolbarMode === 'fixed' && props.selectionToolbar) && editor && state && !reading" :editor="editor" :state="state" :locale="locale" :mentions="mentions"
      :commentable="!!comments?.writable.value || !!props.selectionActions?.length" :selection-actions="props.selectionActions" :enabled="!narrow && !intent && !file && !mention && !blockInsert && !libraryOpen && !blockMenu && !emptyMenu && !slashSession && !comments?.drafting.value" @edit="edit" @file="openFile" @comment="openCommentDraft" />
    <MobileDock v-if="toolbarMode !== 'none' && editor && state && !reading" ref="mobileDock" :editor="editor" :state="state" :locale="locale" :visible="narrow" :fixed="layout === 'document'" :root="root"
      :mentions="mentions" :docx="!!docx" :exporters="props.exporters ?? []" :template-name="hasTemplatePicker ? exportTemplate.name.value : undefined"
      @edit="edit" @file="openFile" @template="libraryOpen = true" @comments="comments?.showList()" @insert="blockInsert = $event" />
    <DocumentLayer @target="documentLayer = $event">
      <BlockSurface v-if="blockControls && !intent && !file && !mention && !blockInsert" :controls="blockControls" :locale="locale" :mentions="!!mentions" v-model:open="blockMenu" @insert="blockInsert = $event" />
      <EmptyInsert v-if="emptyControls && !intent && !file && !mention && !blockInsert" :controls="emptyControls" :locale="locale" :mentions="!!mentions" :mention-source="mentions" v-model:open="emptyMenu" @insert="blockInsert = $event" />
      <ObjectSurface v-if="editor && state" :editor="editor" :state="state" :locale="locale" :enabled="!intent && !file && !mention && !blockInsert && !libraryOpen" :sticky-top="stickyTop" />
    </DocumentLayer>
    <OverlayHost @target="overlayTarget = $event">
      <SlashSurface v-if="slashSession" ref="slashSurface" :session="slashSession" :locale="locale" :mentions="!!mentions" @close="slash.dismiss" @insert="blockInsert = $event" />
      <MentionSurface v-if="mention && editor && (mention.kind === 'document' ? documentLinks : mentions)" :editor="editor" :session="mention"
        :source="(mention.kind === 'document' ? documentLinks?.search : mentions)!" :kind="mention.kind" :locale="locale" @close="mention = undefined" />
      <BlockInsert v-if="blockInsert && state" :request="blockInsert" :state="state" :locale="locale" :mentions="mentions" @close="blockInsert = undefined" />
      <LinkContext v-if="editor" v-model:open="linkContextOpen" :editor="editor" :enabled="linkContextEnabled" :locale="locale" :narrow="narrow" @edit="edit('link', $event)" />
      <TextLinkCard v-if="editor && linkContextEnabled && !linkContextOpen" :editor="editor" :locale="locale" />
      <DocumentPreview v-if="editor && documentLinks?.preview && linkContextEnabled && !linkContextOpen" :editor="editor" :preview="documentLinks.preview" :locale="locale" />
    </OverlayHost>
    <DialogEditor v-if="intent && editor && state" :intent="intent" :editor="editor" :state="state" :locale="locale" :images="images" :documents="documentLinks?.search" @close="intent = undefined" />
    <FileDialog v-if="file && editor && state" :intent="file" :editor="editor" :state="state" :options="filePolicy" :converter="docx ? docx.converter : undefined" :features="{ containers, extras }" :locale="locale"
      :template-picker="hasTemplatePicker" @template="libraryOpen = true" @close="file = undefined" />
    <ShortcutsDialog v-model:open="shortcutsOpen" :locale="locale" :comments="!!comments" :block-menu="!!props.blockControls" />
    <slot v-if="libraryOpen && templates" name="export-templates" :provider="templates" :selected="exportTemplate.selected.value"
      :choose="chooseExportTemplate" :close="() => libraryOpen = false" />
  </div>
  </QuireLocaleProvider>
</template>
<style scoped>
/* Containing block for the editor-sized document layer. */
.md-editor { position: relative; }
.md-editor[data-layout="embedded"] { border: var(--qk-border-width-default) solid var(--qk-color-border-subtle); border-radius: var(--qk-radius-group); }
.md-editor__toolbar { min-width: 0; padding: var(--qk-space-inline); background: var(--qk-color-surface-page); }
.md-editor[data-layout="document"] > .md-editor__toolbar { position: sticky; top: var(--md-editor-toolbar-top, 0px); z-index: var(--qk-layer-chrome); }
/* The document ends with room to scroll its last line up from the window's bottom edge. */
.md-editor[data-layout="document"] > .md-editor__document { max-width: var(--md-editor-document-width, 960px); margin-inline: auto; padding-block: var(--qk-space-group) max(var(--qk-space-section), 25vh); }
/* A full-page document reads at article rhythm: a slightly larger body, room between blocks, and more air above higher headings. */
.md-editor[data-layout="document"] > .md-editor__document :deep(.qk-prose) {
  --qk-type-body-font-size: 15px; --qk-type-body-line-height: 1.6;
  --qk-prose-block-space: var(--qk-space-surface-compact); --qk-prose-heading-space: var(--qk-space-surface);
}
.md-editor[data-layout="document"] > .md-editor__document :deep(.qk-prose :is([data-qk-prose^="h"], h1, h2, h3, h4, h5, h6)) { margin-block-end: var(--qk-space-surface-compact); }
.md-editor[data-layout="document"] > .md-editor__document :deep(.qk-prose :is([data-qk-prose="h1"], h1):not(:first-child)) { margin-block-start: var(--qk-space-page); }
.md-editor[data-layout="document"] > .md-editor__document :deep(.qk-prose :is([data-qk-prose="h2"], h2):not(:first-child)) { margin-block-start: var(--qk-space-section); }
.md-editor[data-layout="document"] > .md-editor__document :deep(.qk-prose :is([data-qk-prose="h3"], h3):not(:first-child)) { margin-block-start: var(--qk-space-group); }
/* Block handles sit up to 62px before the text; narrow editors keep the same margin on both sides so the column stays centered. */
.md-editor[data-block-controls="true"][data-layout="document"] > .md-editor__document { max-width: min(var(--md-editor-document-width, 960px), calc(100% - 144px)); margin-inline: max(72px, calc((100% - var(--md-editor-document-width, 960px)) / 2)); }
.md-editor[data-block-controls="true"][data-layout="embedded"] > .md-editor__document { margin-inline-start: 88px; }
/* The reading view has no block handles, so it keeps no handle gutter and pads both sides evenly. */
.md-editor[data-layout="embedded"] > .md-editor__document.md-editor__reading { margin-inline: 0; padding: var(--qk-space-group) var(--qk-space-surface); }
.md-editor > .md-editor__header { padding: var(--qk-space-section) var(--qk-space-surface) 0; }
/* Header and footer share the document column but not its block padding; this outranks the document and mobile rules. */
.md-editor[data-layout="document"] > .md-editor__document.md-editor__header { padding-block: var(--qk-space-section) 0; }
.md-editor[data-layout="document"] > .md-editor__document.md-editor__footer { padding-block: 0 var(--qk-space-section); }
.md-editor[data-layout] > .md-editor__document.md-editor__error { padding-block: var(--qk-space-group); }
.md-editor :deep(.cm-placeholder) { color: var(--qk-color-text-placeholder); }
.md-editor > .md-editor__footer { padding: 0 var(--qk-space-surface) var(--qk-space-section); }
.md-editor[data-layout="document"] > .md-editor__document[data-has-footer] { padding-block-end: var(--qk-space-group); }
/* Center the document itself, shifting only enough to clear the edge outline and adjacent comments. */
.md-editor[data-rails] {
  position: relative;
  --md-editor-doc-width: min(var(--md-editor-document-width, 960px), calc(100% - var(--md-editor-rail-start) - var(--md-editor-rail-end)));
  --md-editor-doc-start: clamp(var(--md-editor-rail-start), calc((100% - var(--md-editor-doc-width)) / 2), calc(100% - var(--md-editor-doc-width) - var(--md-editor-rail-end)));
}
.md-editor[data-rails][data-layout="document"] > .md-editor__document { max-width: var(--md-editor-doc-width); margin-inline: var(--md-editor-doc-start) 0; }
.md-editor__outline { position: absolute; inset-block: var(--md-editor-toolbar-height, 0px) 0; width: var(--md-editor-outline-width); pointer-events: none;
  inset-inline-end: 24px; }
.md-editor[data-outline-position="start"] > .md-editor__outline { inset-inline-start: 24px; inset-inline-end: auto; }
.md-editor__outline-sticky {
  position: sticky; top: calc(var(--md-editor-toolbar-top, 0px) + var(--md-editor-toolbar-height, 0px) + var(--qk-space-group));
  display: flex; flex-direction: column; gap: var(--qk-space-inline); max-height: calc(100vh - var(--md-editor-toolbar-top, 0px) - var(--md-editor-toolbar-height, 0px) - 2 * var(--qk-space-group));
  margin-block-start: var(--qk-space-group); pointer-events: auto;
}
.md-editor[data-outline="toggle"] .md-editor__outline-sticky { align-items: center; }
.md-editor__outline-title { display: flex; align-items: center; justify-content: space-between; padding-inline-start: var(--qk-space-inline); color: var(--qk-color-text-secondary); font-size: var(--qk-type-helper-font-size); }
.md-editor__comments { position: absolute; inset-block: 0; width: var(--md-editor-comment-width); inset-inline-start: calc(var(--md-editor-doc-start) + var(--md-editor-doc-width) + 24px); }
.md-editor > .md-editor__document[data-has-header] { padding-block-start: var(--qk-space-inline); }
.md-editor__toolbar:has(> .md-editor__panel-toggles, > .md-editor__toolbar-start) { display: flex; align-items: center; gap: var(--qk-space-inline); }
.md-editor__toolbar > .md-editor__toolbar-main { flex: 1; min-width: 0; }
.md-editor__toolbar-start { display: flex; flex: none; }
.md-editor__panel-toggles { display: flex; flex: none; gap: var(--qk-space-tight, 4px); }
/* A docked panel takes the end of the viewport (document layout) or of the frame (embedded); the document re-centers in the rest. */
.md-editor { --md-editor-panel-width: min(420px, 40vw); }
.md-editor[data-panel-open][data-layout="document"] { margin-inline-end: var(--md-editor-panel-width); }
.md-editor[data-panel-open][data-layout="embedded"] { position: relative; padding-inline-end: var(--md-editor-panel-width); }
.md-editor__panel { display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--qk-color-surface-page);
  border-inline-start: var(--qk-border-width-default) solid var(--qk-color-border-subtle); width: var(--md-editor-panel-width); }
/* Hosts whose toolbar sticks inside their own scroller place the fixed panel below their chrome with --md-editor-panel-top. */
.md-editor[data-layout="document"] > .md-editor__panel { position: fixed; inset-block: var(--md-editor-panel-top, var(--md-editor-toolbar-top, 0px)) 0; inset-inline-end: 0; z-index: var(--qk-layer-chrome); }
.md-editor[data-layout="embedded"] > .md-editor__panel { position: absolute; inset-block: 0; inset-inline-end: 0; }
.md-editor__panel > :deep(*) { flex: 1; min-height: 0; }
.md-editor__panel-fab { position: fixed; inset-inline-end: var(--qk-space-group); bottom: calc(var(--qk-space-group) + var(--md-editor-dock-height, 0px)); z-index: var(--qk-layer-chrome); display: grid; gap: var(--qk-space-inline); }
@media (max-width: 767px) {
  .md-editor[data-panel-open][data-layout] { margin-inline-end: 0; padding-inline-end: 0; }
  .md-editor[data-layout] > .md-editor__panel { position: fixed; inset: auto 0 var(--md-editor-dock-height, 0px) 0; width: auto; height: min(75vh, 640px); z-index: var(--qk-layer-chrome);
    border-inline-start: 0; border-block-start: var(--qk-border-width-default) solid var(--qk-color-border-subtle); border-radius: var(--qk-radius-group) var(--qk-radius-group) 0 0; }
  .md-editor[data-layout="document"] > .md-editor__document { padding-block-start: var(--qk-space-inline); padding-block-end: calc(var(--qk-space-section) + max(var(--md-editor-dock-height, 0px), var(--md-editor-task-height, 0px))); }
  .md-editor[data-block-controls="true"][data-layout] > .md-editor__document { max-width: calc(100% - 16px); margin-inline-start: 16px; margin-inline-end: 0; }
}
</style>
