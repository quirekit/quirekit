<script setup lang="ts">
import { computed } from "vue";
import { QuireButton, QuireIcon, QuireSpace, QuireTypography } from "@quirekit/ui/vue";

const props = defineProps<{
  /** Product language. */
  readonly locale: "zh-CN" | "en";
  /** Whether the host needs a model connection before sending. */
  readonly disconnected: boolean;
  /** Whether the host offers connection settings. */
  readonly canConnect: boolean;
  /** Safe host-owned guidance when members cannot configure a connection themselves. */
  readonly connectionHint?: string | undefined;
}>();
const emit = defineEmits<{
  /** Seed an editable draft, without submitting it. */
  draft: [text: string];
  /** Open the host-owned connection settings. */
  connect: [];
}>();
const suggestions = computed(() => props.locale === "zh-CN" ? [
  { icon: "listFilter", title: "梳理文档要点", prompt: "请阅读当前文档，梳理主要内容并提炼关键要点。" },
  { icon: "edit", title: "润色文字表达", prompt: "请润色当前文档的表达，保留原意，让文字更清晰、流畅。" },
  { icon: "fileText", title: "起草新的内容", prompt: "请帮我起草一段内容，主题是：" }
] : [
  { icon: "listFilter", title: "Find the key points", prompt: "Read the current document and summarize its key points." },
  { icon: "edit", title: "Refine the writing", prompt: "Refine the wording of the current document for clarity and flow, preserving its meaning." },
  { icon: "fileText", title: "Draft something new", prompt: "Help me draft a passage about: " }
]);
</script>

<template>
  <QuireSpace class="qk-ai-welcome" orientation="vertical" gap="surface" block>
    <QuireSpace orientation="vertical" gap="inline">
      <QuireTypography as="h2" variant="heading">{{ locale === 'zh-CN' ? '这份文档，想改进哪里？' : 'What would you like to work on?' }}</QuireTypography>
      <QuireTypography variant="compact" class="qk-ai-chat__secondary">{{ locale === 'zh-CN' ? '询问内容，或直接告诉我你的修改想法。' : 'Ask about the document, or describe a change.' }}</QuireTypography>
    </QuireSpace>
    <QuireSpace orientation="vertical" :gap="0" :aria-label="locale === 'zh-CN' ? '试试这些文档任务' : 'Try a document task'">
      <QuireButton v-for="suggestion in suggestions" :key="suggestion.icon" class="qk-ai-chat__start-action"
        variant="ghost" size="sm" block @click="emit('draft', suggestion.prompt)">
        <template #leading><QuireIcon :name="suggestion.icon" :size="16" /></template>
        {{ suggestion.title }}
      </QuireButton>
    </QuireSpace>
    <QuireSpace v-if="disconnected" gap="inline">
      <QuireTypography variant="helper" class="qk-ai-chat__secondary">{{ locale === 'zh-CN' ? '开始之前' : 'Before you start' }}</QuireTypography>
      <QuireButton v-if="canConnect" size="xs" color="primary" variant="ghost" @click="emit('connect')">
        {{ locale === 'zh-CN' ? '连接 AI 模型' : 'Connect an AI model' }}
        <template #trailing><QuireIcon name="arrowRight" :size="12" /></template>
      </QuireButton>
      <QuireTypography v-else variant="helper" class="qk-ai-chat__secondary">{{ connectionHint ?? (locale === 'zh-CN' ? '请在应用设置中配置模型连接。' : 'Set up a model connection in your application settings.') }}</QuireTypography>
    </QuireSpace>
  </QuireSpace>
</template>
