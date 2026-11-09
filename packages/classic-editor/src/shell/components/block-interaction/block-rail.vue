<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { QuireBlockHandle, QuireIconButton, QuireIcon, QuireMenu, QuireMenuItem, QuireMenuSeparator, QuireTooltipRoot, QuireTooltipTrigger, QuireTooltipContent } from "@quirekit/ui/vue";
import { ClassicEditorAnchoredOverlay, projectClassicEditorAnchoredOverlayAnchor, resolveClassicEditorDocumentOverlayHost } from "@classic/ui/anchored-overlay";
import type { ClassicEditorShellModel } from "../../types";
import { useBlockRail } from "./use-block-rail";
import { useBlockTypes } from "./use-block-types";
import { railHeight, railInset, railInsertWidth, railWidth, useBlockPresentation } from "./presentation";
import BlockFormatting from "./menu/formatting.vue";
import InsertPanel from "./insert/panel.vue";
import InsertSubmenu from "./menu/insert-submenu.vue";
import BlockComment from "./menu/comment.vue";
import type { ClassicEditorSelectionPopupTrigger } from "@classic/types";

/** Product-owned rail inputs. */
interface Props {
  /** Current shell context. */
  readonly model: ClassicEditorShellModel;
  /** Product root and clipping owner. */
  readonly root: HTMLElement | undefined;
}
const props = defineProps<Props>();
const { hover, menu, preview, editor, press, open, openInsert, move, insertionTarget } = useBlockRail(toRef(props, "model"), toRef(props, "root"));
const { types, typeItems, convert } = useBlockTypes(toRef(props, "model"), menu);
const english = computed(() => props.model.locale.startsWith("en"));
const presentation = useBlockPresentation(toRef(props, "model"), computed(() => hover.value?.block.node));
const anchor = computed(() => {
  if (!hover.value) return null;
  const rect = hover.value.fragment.rect;
  const corridor = railWidth + (presentation.value?.empty ? railInsertWidth : 0);
  // Anchor to the launcher corridor so the menu never covers its own handle.
  return { x: rect.x - corridor, y: rect.y, rects: [{ x: rect.x - corridor, y: rect.y, width: corridor, height: rect.height }] };
});
/** @returns Rail top centered on the block's first line, or null when that line is not in the hovered fragment. */
function railTop(): number | null {
  const current = hover.value, view = editor()?.view;
  if (!current || !view || !current.block.node.isTextblock) return null;
  const line = view.coordsAtPos(current.block.from + 1), { y, height } = current.fragment.rect;
  return line.top >= y && line.bottom <= y + height ? (line.top + line.bottom - railHeight) / 2 : null;
}
const railPlacement = computed(() => {
  const host = props.root && resolveClassicEditorDocumentOverlayHost(props.root);
  if (!host || !hover.value) return null;
  // Anchored by its right edge: the optional insert button grows away from the text.
  const point = projectClassicEditorAnchoredOverlayAnchor({ x: hover.value.fragment.rect.x - railInset, y: railTop() ?? hover.value.fragment.rect.y }, host);
  return { host, style: { left: `${point.x}px`, top: `${point.y}px` } };
});
const clipboardError = ref(false);
const trigger = computed<ClassicEditorSelectionPopupTrigger | null>(() => {
  const selection = props.model.context?.editor.state.pm.selection;
  const rect = hover.value?.fragment.rect;
  if (!rect || !selection || menu.value !== "block" || selection.toJSON().type !== "quire-block-range") return null;
  return { kind: "selection-popup", from: selection.from, to: selection.to,
    rect: { left: rect.x, right: rect.x + rect.width, top: rect.y, bottom: rect.y + rect.height, width: rect.width, height: rect.height } };
});

/** @param zh - Chinese label. @param en - English label. @returns Active localized label. */
const text = (zh: string, en: string): string => english.value ? en : zh;
/** @param event - Rail press whose trigger owns focus after menu cancellation. */
function focusHandle(event: PointerEvent): void {
  if (event.button === 0 && event.isPrimary !== false && event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true });
}
/** @param action - Captured command closure. */
const execute = (action: () => unknown): void => { action(); menu.value = null; editor()?.view.focus(); };
/** @param cut - Routes copy or cut through the mounted rich clipboard controller. */
function copy(cut = false): void {
  const e = editor();
  const ownerDocument = props.root?.ownerDocument;
  if (!e || !ownerDocument) return;
  clipboardError.value = false;
  // Match the table toolbar's native route: the controller owns every MIME,
  // resource hook and protected cut, including selections containing no text.
  e.view.focus();
  try {
    clipboardError.value = !ownerDocument.execCommand(cut ? "cut" : "copy");
    if (!clipboardError.value) menu.value = null;
  } catch { clipboardError.value = true; }
}
watch(menu, () => { clipboardError.value = false; });
</script>

<template>
  <Teleport v-if="railPlacement" :to="railPlacement.host">
    <div v-if="hover && !preview && presentation" class="qk-block-rail" :style="railPlacement.style" data-block-rail>
      <QuireTooltipRoot v-if="presentation.empty" :disabled="menu !== null" placement="top">
        <QuireTooltipTrigger as-child>
          <QuireIconButton size="xs" variant="ghost" :label="text('插入块', 'Insert block')" data-block-add @pointerdown.stop.prevent="focusHandle" @click="openInsert('before')"><QuireIcon name="plus" /></QuireIconButton>
        </QuireTooltipTrigger>
        <QuireTooltipContent :content="text('插入块', 'Insert block')" />
      </QuireTooltipRoot>
      <QuireTooltipRoot :disabled="menu !== null" placement="top">
        <QuireTooltipTrigger as-child>
          <QuireBlockHandle :label="text('拖动或打开块菜单', 'Drag or open block menu')" :badge="presentation.badge" :icon="presentation.icon" :tone="presentation.tone" :aria-expanded="menu === 'block'" aria-haspopup="menu" data-block-handle @pointerdown="focusHandle($event); press($event)" @keydown.enter.prevent="open" @keydown.space.prevent="open" />
        </QuireTooltipTrigger>
        <QuireTooltipContent :content="text('拖动排序 · 点击打开菜单', 'Drag to reorder · Click for menu')" />
      </QuireTooltipRoot>
    </div>
  </Teleport>
  <Teleport v-if="root" :to="root">
    <div v-if="preview" class="qk-block-ghost" :style="{ left: `${preview.x}px`, top: `${preview.y}px` }" data-block-ghost>
      <QuireIcon name="gripVertical" :size="16" />
      <span class="qk-block-ghost__text">{{ preview.text || text('所选块', 'Selected block') }}</span>
      <span v-if="preview.count > 1" class="qk-block-ghost__count">{{ preview.count }}</span>
    </div>
    <div v-if="preview?.line" class="qk-block-drop-line" :style="{ left: `${preview.line.x}px`, top: `${preview.line.y}px`, width: `${preview.line.width}px` }" data-block-drop-line />
  </Teleport>
  <ClassicEditorAnchoredOverlay v-if="root" :editor-root="root" :show="menu !== null" :anchor="anchor" placement="left-start" overlay-family="block-menu" @update:show="!$event && (menu = null)">
    <template #default="{ ownerAttributes, style, portalTarget }">
      <QuireMenu v-bind="ownerAttributes" :style="[style, { '--qk-toolbar-surface': 'transparent' }]" :open="menu !== null" :initial-focus="menu === 'block' ? 'menu' : 'auto'" :width="menu === 'insert' ? '240px' : '200px'" :positioned="false" :portalled="false" :close-on-select="false" :aria-label="menu === 'insert' ? text('插入内容', 'Insert content') : text('块操作', 'Block actions')" :lang="model.locale" data-block-menu @update:open="!$event && (menu = null)">
        <InsertPanel v-if="menu === 'insert' && insertionTarget()" :model="model" :target="insertionTarget()!" :types="types"
          :parent-id="ownerAttributes['data-qk-classic-overlay']" :portal-target="portalTarget" @close="menu = null" />
        <template v-else>
          <BlockFormatting v-if="trigger" :model="model" :trigger="trigger" :types="typeItems" :parent-id="ownerAttributes['data-qk-classic-overlay']" :portal-target="portalTarget" @convert="convert" @close="menu = null" />
          <InsertSubmenu v-for="side in (['before', 'after'] as const)" :key="side" :model="model" :side="side"
            :parent-id="ownerAttributes['data-qk-classic-overlay']" :items="types" :resolve-target="insertionTarget" :portal-target="portalTarget" @close="menu = null" />
          <QuireMenuSeparator />
          <QuireMenuItem value="up" :disabled="!move(-1, true)" @select="move(-1)"><template #leading><QuireIcon name="moveUp" style="color: var(--qk-color-info-text)" /></template>{{ text('上移', 'Move up') }}</QuireMenuItem>
          <QuireMenuItem value="down" :disabled="!move(1, true)" @select="move(1)"><template #leading><QuireIcon name="moveDown" style="color: var(--qk-color-info-text)" /></template>{{ text('下移', 'Move down') }}</QuireMenuItem>
          <QuireMenuSeparator />
          <QuireMenuItem value="copy" shortcut="⌘C" :close-on-select="false" @select="copy()"><template #leading><QuireIcon name="copy" style="color: var(--qk-color-success-text)" /></template>{{ text('复制', 'Copy') }}</QuireMenuItem>
          <QuireMenuItem value="cut" shortcut="⌘X" :close-on-select="false" :disabled="!editor()?.can().deleteSelection()" @select="copy(true)"><template #leading><QuireIcon name="scissors" style="color: var(--qk-color-action-text)" /></template>{{ text('剪切', 'Cut') }}</QuireMenuItem>
          <QuireMenuItem value="delete" shortcut="⌫" tone="danger" :disabled="!editor()?.can().deleteSelection()" @select="execute(() => editor()?.commands.deleteSelection())"><template #leading><QuireIcon name="trash" /></template>{{ text('删除', 'Delete') }}</QuireMenuItem>
          <BlockComment v-if="trigger" :model="model" :trigger="trigger" @close="menu = null" />
          <p v-if="clipboardError" role="status">{{ text('复制未完成，请使用系统复制快捷键重试。', 'Copy failed. Try the system copy shortcut.') }}</p>
        </template>
      </QuireMenu>
    </template>
  </ClassicEditorAnchoredOverlay>
</template>

<style>
.qk-block-rail { position: absolute; z-index: 20; pointer-events: auto; display: flex; align-items: center; gap: 2px; height: 26px; transform: translateX(-100%); }
.qk-block-ghost { position: fixed; z-index: 100; pointer-events: none; display: flex; align-items: center; gap: var(--qk-space-inline); max-width: 280px; padding: var(--qk-space-inline-tight) var(--qk-space-inline); border-radius: var(--qk-radius-control); background: var(--qk-color-surface-raised); color: var(--qk-color-text-primary); box-shadow: var(--qk-elevation-overlay); font: var(--qk-type-helper-font-size)/var(--qk-type-helper-line-height) var(--qk-type-helper-font-family); }
.qk-block-ghost__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qk-block-ghost__count { color: var(--qk-color-text-secondary); font-variant-numeric: tabular-nums; }
.qk-block-drop-line { position: fixed; z-index: 100; height: 2px; background: var(--qk-color-action-primary); pointer-events: none; }
.qk-block-drop-line::before { content: ""; position: absolute; width: 6px; height: 6px; left: -3px; top: -2px; border-radius: 50%; background: inherit; }
</style>
