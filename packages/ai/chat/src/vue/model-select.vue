<script setup lang="ts">
import { computed, ref } from "vue";
import { QuireButton, QuireIcon, QuireMenu, QuireMenuRadioGroup, QuireMenuRadioItem } from "@quirekit/ui/vue";
import type { AiChatModelDescriptor } from "../types";

const props = defineProps<{
  /** Host-owned model options. */
  readonly models: readonly AiChatModelDescriptor[];
  /** Currently selected model identity. */
  readonly modelValue: string;
  /** A running turn keeps its model fixed. */
  readonly disabled: boolean;
  /** Product language. */
  readonly locale: "zh-CN" | "en";
}>();
const emit = defineEmits<{
  /** Select an existing host-owned model. */
  "update:modelValue": [id: string];
}>();
const open = ref(false);
const selected = computed(() => props.models.find(model => model.id === props.modelValue));
const label = computed(() => props.locale === "zh-CN" ? "选择 AI 模型" : "Select AI model");

/** Select only a current option and return keyboard focus through the public Menu.
 * @param value - Selected host model identity.
 */
function choose(value: string): void {
  if (props.disabled || !props.models.some(model => model.id === value)) return;
  emit("update:modelValue", value);
  open.value = false;
}
</script>

<template>
  <QuireMenu v-model:open="open" :aria-label="label" placement="top-end" width="auto" min-width="220px" max-width="320px">
    <template #trigger>
      <QuireButton class="qk-ai-chat__model-trigger" size="xs" variant="ghost" :disabled="disabled"
        :aria-label="`${label}: ${selected?.label ?? ''}`" :title="selected?.label" data-ai-model-trigger>
        <span class="qk-ai-chat__model-name">{{ selected?.label ?? label }}</span>
        <template #trailing><QuireIcon name="chevronDown" :size="12" /></template>
      </QuireButton>
    </template>
    <QuireMenuRadioGroup :model-value="modelValue" @update:model-value="choose">
      <QuireMenuRadioItem v-for="model in models" :key="model.id" :value="model.id" :description="model.provider" close-on-select>
        {{ model.label }}
      </QuireMenuRadioItem>
    </QuireMenuRadioGroup>
  </QuireMenu>
</template>
