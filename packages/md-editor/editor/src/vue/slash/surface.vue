<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { QuireCommandList, QuireIcon, QuirePopoverRoot, QuirePopoverAnchor, QuirePopoverContent, QuireScrollArea, type QuireKitCommandListHandle } from "@quirekit/ui/vue";
import type { MdEditorLocale } from "../types";
import type { MdSlashSession } from "./types";
import { useMdOverlayTarget } from "../overlays/context";
import { blockInsertionItems, blockInsertionSource } from "../blocks/insertion/catalog";
import { blockInsertionCommand } from "../blocks/insertion/command";
import { blockToneStyle } from "../blocks/tones";
import { searchBlockInsertions } from "../blocks/insertion/search";
import type { MdBlockInsertionRequest, MdBlockInsertionTarget } from "../blocks/insertion/types";
const props = defineProps<{
  /** Measured native query and versioned replacement intent. */ session: MdSlashSession;
  /** Product language. */ locale: MdEditorLocale;
  /** Whether host contacts are installed. */ mentions: boolean;
}>();
const emit = defineEmits<{
  /** Dismiss without changing the typed slash query. */ close: [];
  /** Reuse the shared parameter editor before replacing source. */ insert: [request: MdBlockInsertionRequest];
}>();
const portal = useMdOverlayTarget(), list = shallowRef<QuireKitCommandListHandle>();
const editor = computed(() => props.session.controls.editor);
const catalog = computed(() => blockInsertionItems(editor.value, props.locale, props.mentions));
const items = computed(() => searchBlockInsertions(catalog.value, props.session.query));
const label = computed(() => props.locale === "en" ? "Insert content" : "插入内容");
const target = computed<MdBlockInsertionTarget>(() => ({ controls: props.session.controls, side: "replace" }));
/** @param event - Native editor keydown. @returns Whether the shared command list consumed it. */
function handleKeydown(event: KeyboardEvent): boolean { return list.value?.handleKeydown(event) ?? false; }
/** @param value - Selected installed insertion identity. */
function insert(value: string): void {
  if (!items.value.some(item => item.key === value)) return;
  const source = blockInsertionSource(editor.value, props.locale, value);
  const request = { ...target.value, value };
  if (source !== null) {
    if (editor.value.run(blockInsertionCommand(target.value, source), props.session.controls.target).ok) emit("close");
  } else {
    // Source stays intact until the shared parameter writer confirms its draft.
    emit("insert", request); emit("close");
  }
}
defineExpose({ handleKeydown });
</script>
<template>
  <QuirePopoverRoot :open="true" :auto-focus="false" :restore-focus="false" placement="bottom-start" @update:open="!$event && emit('close')">
    <QuirePopoverAnchor><span aria-hidden="true" class="md-slash-anchor" :style="{ left: `${session.controls.rect.left}px`, top: `${session.controls.rect.top + session.controls.rect.height}px` }" /></QuirePopoverAnchor>
    <QuirePopoverContent :portal-target="portal ?? 'body'" :show-arrow="false" padding="none" border="subtle" width="256px" :aria-label="label" data-md-slash-menu data-qk-not-prose>
      <QuireScrollArea scrollbar-visibility="always" viewport-class="md-slash-viewport">
        <QuireCommandList ref="list" :label="label" :items="items" :focus-owner="session.input" @select="insert">
          <template #leading="{ index }"><QuireIcon v-if="items[index]?.icon" :name="items[index]!.icon!" :style="blockToneStyle(items[index]!.key)" /></template>
        </QuireCommandList>
        <p v-if="!items.length" role="status" class="m-0 p-qk-surface text-qk-helper text-qk-text-secondary">{{ locale === 'en' ? 'No matching blocks' : '没有匹配的内容' }}</p>
      </QuireScrollArea>
    </QuirePopoverContent>
  </QuirePopoverRoot>
</template>
<style scoped>
.md-slash-anchor { position: fixed; width: 1px; height: 1px; pointer-events: none; }
:deep(.md-slash-viewport) { height: auto; max-height: min(360px, 55dvh, calc(var(--available-height, 100dvh) - 16px)); }
</style>
