<script setup lang="ts">
import { computed } from "vue";
import { QuireMenuGroup, QuireMenuItem, QuireIcon, QuireScrollArea } from "@quirekit/ui/vue";
import type { MdBlockInsertionTarget } from "./types";
import { blockInsertionCommand } from "./command";
import type { MdEditorLocale } from "../../types";
import { blockInsertionItems, blockInsertionSource } from "./catalog";
import { blockToneStyle } from "../tones";
const props = defineProps<{
  /** Frozen block boundary or empty-line destination. */ target: MdBlockInsertionTarget;
  /** Product language. */ locale: MdEditorLocale;
  /** Whether the host supplies contacts. */ mentions: boolean;
}>();
const emit = defineEmits<{ /** Parameterized or immediate feature intent. */ select: [value: string] }>();
const groups = computed(() => blockInsertionItems(props.target.controls.editor, props.locale, props.mentions).map(group => ({ ...group,
  children: group.children?.map(item => ({ ...item, disabled: !props.target.controls.editor.can(blockInsertionCommand(props.target,
    blockInsertionSource(props.target.controls.editor, props.locale, item.value) ?? "text"), props.target.controls.target) })),
})));
</script>
<template>
  <QuireScrollArea scrollbar-visibility="always" class="md-block-insert-scroll" data-md-block-insert-scroll>
    <QuireMenuGroup v-for="group in groups" :key="group.value" :label="group.label">
      <QuireMenuItem v-for="item in group.children" :key="item.value" :value="`${target.side}-${item.value}`" :disabled="item.disabled ?? false" @select="emit('select', item.value)">
        <template #leading><QuireIcon :name="item.icon!" :style="blockToneStyle(item.value)" /></template>{{ item.label }}
      </QuireMenuItem>
    </QuireMenuGroup>
  </QuireScrollArea>
</template>
<style scoped>
.md-block-insert-scroll { height: min(440px, 56dvh, calc(var(--available-height, 100dvh) - 16px)); min-height: 0; }
</style>
