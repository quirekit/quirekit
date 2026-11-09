<script setup lang="ts">
import { computed } from "vue";
import QuireButton from "../button/button.vue";
import QuireIcon from "../icon/icon.vue";
import { quireBlockHandleWidth, quireBlockToneColor } from "./presentation";
import type { QuireBlockHandleProps } from "./types";

const props = withDefaults(defineProps<QuireBlockHandleProps>(), { tone: "neutral" });
const typeStyle = computed(() => ({ color: quireBlockToneColor(props.tone) }));
</script>
<template>
  <QuireButton size="xs" color="neutral" variant="outline" class="qk-block-handle" :aria-label="label" :style="{ width: `${quireBlockHandleWidth}px` }">
    <span class="qk-block-handle__content" aria-hidden="true">
      <span class="qk-block-handle__type" :style="typeStyle"><span v-if="badge" class="qk-type-helper">{{ badge }}</span><QuireIcon v-else-if="icon" :name="icon" :size="16" /></span>
      <QuireIcon name="gripVertical" :size="16" class="qk-block-handle__grip" />
    </span>
  </QuireButton>
</template>
<style scoped>
/* A quiet chip on the page: hairline edge, no fill until hover; the block type carries the color, the grip stays muted. */
.qk-block-handle { cursor: grab; touch-action: none; padding-inline: 1px 2px; border-radius: var(--qk-radius-group);
  border-color: var(--qk-color-border-subtle); background: var(--qk-color-surface-page); box-shadow: none; }
.qk-block-handle:hover, .qk-block-handle[aria-expanded="true"] { background: var(--qk-color-surface-hover); }
.qk-block-handle__content { display: flex; align-items: center; justify-content: center; gap: 1px; }
.qk-block-handle__type { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; font-weight: var(--qk-type-heading-font-weight); }
.qk-block-handle__grip { color: var(--qk-color-text-placeholder); }
</style>
