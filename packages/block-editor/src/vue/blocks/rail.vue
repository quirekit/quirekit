<script setup lang="ts">
import { useBlockLocale } from "../localization/use-locale";
import { EditorUIAnchoredOverlay } from "@quirekit/editor-ui/vue";
import { computed, ref } from "vue";
import type { Editor } from "@quirekit/core";
import { QuireBlockHandle, QuireIconButton, QuireIcon, QuireMenu, QuireTooltipRoot, QuireTooltipTrigger, QuireTooltipContent } from "@quirekit/ui/vue";
import { copyBlockLink } from "../../sections/links";
import { sectionTarget } from "../../sections/query";
import { copyBlockRange } from "../../ui/blocks/clipboard";
import { executeBlockAction } from "../../ui/blocks/actions";
import type { BlockAction } from "../../ui/blocks/types";
import BlockInsertPicker from "../insert/picker.vue";
import BlockMenuItems from "./items.vue";
import BlockDragPreview from "./drag/preview.vue";
import { useBlockRail } from "./gutter/state";
import { createBlockRailPresenter } from "./gutter/presentation";
import { blockRailMetrics } from "./gutter/geometry";
import { useBlockMenuContext } from "./context";
import { restoreBlockEditorFocus } from "../../ui/focus";

const { t } = useBlockLocale();

const emit = defineEmits<{ feedback: [message: string] }>();
const props = defineProps<{ editor: Editor; viewport: HTMLElement }>();
const { hover, anchor, target, menu, preview, snapshot, open, press, restoreAfterEscape } = useBlockRail(props.editor, props.viewport);
const gutter = ref<HTMLElement>();
const present = createBlockRailPresenter(props.editor);
const presentation = computed(() => hover.value ? present(hover.value.block.node) : null);
// Position the overlay itself, so its hit rectangle never covers the nearby
// disclosure or text. These dimensions are shared with the public button roots.
const { handle: handleWidth, control: controlSize, gap: controlGap } = blockRailMetrics;
const railAnchor = computed(() => anchor.value ? {
  x: anchor.value.x - handleWidth - (presentation.value?.empty ? controlSize + controlGap : 0),
  y: anchor.value.y - controlSize / 2
} : null);
const context = useBlockMenuContext(props.editor, target, () => menu.value === "block");
const slot = computed(() => target.value ? ({ target: target.value.block, side: "before" as const, expectedDocumentRevision: target.value.range.expectedDocumentRevision }) : undefined);
const menuAnchor = computed(() => {
  if (!menu.value) return null;
  const rect = gutter.value?.getBoundingClientRect();
  return rect ? { x: rect.left, y: rect.bottom } : anchor.value;
});
/** @param value - Captured structural action. */
async function execute(value: string): Promise<void> {
  if (value.includes("/")) { restoreBlockEditorFocus(props.editor); context.value?.execute(value); menu.value = null; return; }
  if (target.value && value === "link") {
    const source = target.value; menu.value = null;
    const copied = await copyBlockLink(props.editor, source);
    emit("feedback", copied ? "已复制块链接" : "复制失败，请重试");
    return;
  }
  if (target.value && (value === "copy" || value === "cut" || value === "copy-section")) {
    const source = value === "copy-section" ? sectionTarget(props.editor, target.value.block.blockId) : target.value;
    if (!source || source.range.expectedDocumentRevision !== target.value.range.expectedDocumentRevision) return;
    menu.value = null;
    const copied = await copyBlockRange(props.editor, source, value === "cut");
    emit("feedback", copied ? (value === "cut" ? "已剪切所选块" : "已复制所选块") : "剪贴板操作未完成，原内容已保留。可使用快捷键重试。");
    return;
  }
  if (target.value) executeBlockAction(props.editor, target.value, value as BlockAction);
  menu.value = null;
}
</script>
<template>
  <EditorUIAnchoredOverlay :show="!!hover && !preview" :anchor="railAnchor" unconstrained layer="chrome">
    <div v-if="presentation" ref="gutter" class="qk-block-gutter" data-block-rail :style="{ '--qk-block-handle-size': `${controlSize}px`, gap: `${controlGap}px` }">
      <QuireIconButton v-if="presentation.empty" class="qk-block-gutter__insert" :label="t('插入块')" variant="ghost" size="xs" @pointerdown.prevent @click="open('insert')"><QuireIcon name="plus" /></QuireIconButton>
      <QuireTooltipRoot :disabled="!!menu || !!preview">
        <QuireTooltipTrigger as-child>
          <QuireBlockHandle :label="t('拖动或打开块菜单')" :badge="presentation.badge" :icon="presentation.icon" :tone="presentation.tone" class="qk-block-gutter__handle" :data-block-type="presentation.id" :aria-description="t(presentation.label)" :aria-expanded="menu === 'block'" aria-haspopup="menu" @pointerdown="press" @keydown.enter.prevent="open()" @keydown.space.prevent="open()" />
        </QuireTooltipTrigger>
        <QuireTooltipContent :content="t('{label} · 点击打开菜单，拖动调整顺序', { label: t(presentation.label) })" />
      </QuireTooltipRoot>
    </div>
  </EditorUIAnchoredOverlay>
  <EditorUIAnchoredOverlay :show="!!menu" :anchor="menuAnchor" placement="bottom-start">
    <QuireMenu v-if="menu === 'block'" :open="true" :portalled="false" :positioned="false" :aria-label="t('块操作')" :close-on-select="false" width="208px" @keydown="restoreAfterEscape" @update:open="!$event && (menu = null)">
      <BlockMenuItems :editor="editor" :target="target" :context-items="context?.items" @select="execute" @close="menu = null" />
    </QuireMenu>
    <BlockInsertPicker v-if="menu === 'insert' && slot" :editor="editor" :destination="slot" @close="menu = null" />
  </EditorUIAnchoredOverlay>
  <EditorUIAnchoredOverlay :show="!!preview" :anchor="preview ? { x: preview.x, y: preview.y } : null" unconstrained>
    <BlockDragPreview v-if="snapshot" :snapshot="snapshot" />
  </EditorUIAnchoredOverlay>
  <EditorUIAnchoredOverlay :show="!!preview?.line" :anchor="preview?.line ?? null" unconstrained>
    <div v-if="preview?.line" class="qk-block-drop-indicator" :style="{ width: `${preview.line.width}px` }" data-block-drop-line />
  </EditorUIAnchoredOverlay>
</template>
