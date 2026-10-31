<script setup lang="ts">
import {
  QuireButton,
  QuireDialogContent,
  QuireDialogRoot,
  QuireIcon,
  QuireMenu,
  QuireMenuRadioGroup,
  QuireMenuRadioItem
} from "@quirekit/ui/vue";
import { computed, ref } from "vue";
import type { AiChatAuthorizationMode, AiChatAuthorizationPresentation } from "../types";

const props = defineProps<{
  /** Active product locale. */
  readonly locale: "zh-CN" | "en";
  /** Current durable authorization preset. */
  readonly modelValue: AiChatAuthorizationMode;
  /** Whether a running turn freezes its captured preset. */
  readonly disabled: boolean;
  /** Host wording that replaces the generic label and description of a preset. */
  readonly presentation?: Partial<Record<AiChatAuthorizationMode, AiChatAuthorizationPresentation>> | undefined;
}>();

const emit = defineEmits<{
  /** Commits an explicit authorization preset. */
  "update:modelValue": [mode: AiChatAuthorizationMode];
}>();

const open = ref(false);
const confirmingFullAccess = ref(false);
const labels = computed(() => {
  const generic = props.locale === "zh-CN"
    ? { "request-approval": "请求批准", "full-access": "完全访问" }
    : { "request-approval": "Request approval", "full-access": "Full access" };
  return {
    "request-approval": props.presentation?.["request-approval"]?.label ?? generic["request-approval"],
    "full-access": props.presentation?.["full-access"]?.label ?? generic["full-access"]
  };
});

const options = computed(() => [
  { value: "request-approval", icon: "lock", description: props.presentation?.["request-approval"]?.description
    ?? (props.locale === "zh-CN" ? "完成后一次确认全部修改" : "Confirm all changes once at the end") },
  { value: "full-access", icon: "lockOpen", description: props.presentation?.["full-access"]?.description
    ?? (props.locale === "zh-CN" ? "无需确认；文档开着修订时仍记为修订" : "No confirmation; tracked changes still record edits") }
] as const);

/**
 * Selects a safe preset or enters explicit full-access confirmation.
 *
 * @param mode - User-selected preset.
 */
function choose(mode: string): void {
  if (mode !== "request-approval" && mode !== "full-access") {
    return;
  }
  if (mode === "full-access" && props.modelValue !== "full-access") {
    confirmingFullAccess.value = true;
    open.value = false;
    return;
  }
  emit("update:modelValue", mode);
  open.value = false;
  confirmingFullAccess.value = false;
}

/** Commits full access after the user acknowledges its direct-write boundary. */
function confirmFullAccess(): void {
  emit("update:modelValue", "full-access");
  open.value = false;
  confirmingFullAccess.value = false;
}

</script>

<template>
  <div>
    <QuireMenu
      v-model:open="open"
      :aria-label="locale === 'zh-CN' ? '授权模式' : 'Authorization mode'"
      placement="top-start"
      width="240px"
    >
      <template #trigger>
        <QuireButton
          :data-mode="modelValue"
          :disabled="disabled"
          data-ai-authorization-trigger="true"
          size="xs"
          variant="ghost"
          :color="modelValue === 'full-access' ? 'warning' : 'neutral'"
        >
          <template #leading><QuireIcon :name="modelValue === 'full-access' ? 'lockOpen' : 'lock'" :size="12" /></template>
          {{ labels[modelValue] }}
          <template #trailing><QuireIcon name="chevronDown" :size="12" /></template>
        </QuireButton>
      </template>
      <QuireMenuRadioGroup
        :model-value="modelValue"
        @update:model-value="choose"
      >
        <QuireMenuRadioItem v-for="option in options" :key="option.value" :value="option.value" :description="option.description" close-on-select>
          <template #leading><QuireIcon :name="option.icon" :size="16" /></template>
          {{ labels[option.value] }}
        </QuireMenuRadioItem>
      </QuireMenuRadioGroup>
    </QuireMenu>
    <QuireDialogRoot
      v-model:open="confirmingFullAccess"
      role="alertdialog"
    >
      <QuireDialogContent
        :title="locale === 'zh-CN' ? '启用完全访问？' : 'Enable full access?'"
        :description="locale === 'zh-CN'
          ? 'AI 将无需逐次批准即可修改正文；你仍可使用普通撤销。'
          : 'AI may edit the document without per-change approval. Ordinary Undo remains available.'"
        size="small"
        :show-close="false"
      >
        <template #footer>
          <QuireButton size="sm" variant="text" @click="confirmingFullAccess = false">
            {{ locale === 'zh-CN' ? '取消' : 'Cancel' }}
          </QuireButton>
          <QuireButton size="sm" color="danger" variant="solid" @click="confirmFullAccess">
            {{ locale === 'zh-CN' ? '启用' : 'Enable' }}
          </QuireButton>
        </template>
      </QuireDialogContent>
    </QuireDialogRoot>
  </div>
</template>
