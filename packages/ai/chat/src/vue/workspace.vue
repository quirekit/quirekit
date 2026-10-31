<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from "vue";
import { QuireButton, QuireChatComposer, QuireChatMessageList, QuireIcon, QuireIconButton, QuireScrollArea, QuireSpace, QuireTypography } from "@quirekit/ui/vue";
import type { QuireKitChatComposerInstance } from "@quirekit/ui";
import { QuireMarkdown } from "@quirekit/incremark/vue";
import type { AiChatController, AiChatReview } from "../types";
import AuthorizationSelect from "./authorization-select.vue";
import DocumentReview from "./document-review.vue";
import ModelSelect from "./model-select.vue";
import Welcome from "./welcome.vue";
import { projectChatMessages } from "./projection";

const props = defineProps<{
  /** Product-owned controller; mounting never owns its lifetime. */
  readonly controller: AiChatController;
  /** Product language. */
  readonly locale: "zh-CN" | "en";
}>();
const emit = defineEmits<{ /** Hide this surface while preserving its session. */ close: [] }>();
const snapshot = shallowRef(props.controller.getSnapshot());
const unsubscribe = props.controller.subscribe(value => { snapshot.value = value; });
onBeforeUnmount(unsubscribe);
const messages = computed(() => projectChatMessages(snapshot.value, props.locale));
const composer = ref<QuireKitChatComposerInstance>();
const disconnected = computed(() => props.controller.options.providerStatus?.state === "local" || props.controller.options.providerStatus?.state === "fallback");
/** Let the user refine a suggested request before any model or document work.
 * @param text - Suggested instruction.
 */
async function draftSuggestion(text: string): Promise<void> {
  const draft = snapshot.value.draft;
  props.controller.setDraft(draft.trim() ? `${draft}\n\n${text}` : text);
  await nextTick();
  composer.value?.focus({ preventScroll: true });
}
/** @param value - SDK review projection carried through a public custom Part. @returns Typed review. */
function asReview(value: unknown): AiChatReview { return value as AiChatReview; }
</script>

<template>
  <section class="qk-ai-chat" data-ai-chat-workspace="true" data-qk-devtools-ignore-interactions aria-label="Quire AI">
    <header class="qk-ai-chat__header">
      <QuireSpace block justify="between" :wrap="false">
        <QuireSpace :wrap="false">
          <QuireIcon name="sparkles" :size="16" />
          <QuireTypography as="span" variant="control">{{ controller.options.title ?? 'Quire AI' }}</QuireTypography>
        </QuireSpace>
        <QuireSpace :gap="0" :wrap="false">
          <QuireIconButton v-for="action in controller.options.headerActions ?? []" :key="action.id" :label="action.label" size="sm" variant="text" @click="action.run()"><QuireIcon :name="action.icon" :size="16" /></QuireIconButton>
          <QuireIconButton v-if="controller.options.providerSettings" :label="locale === 'zh-CN' ? '配置 AI 连接' : 'Configure AI connection'" size="sm" variant="text" @click="controller.options.providerSettings.open()"><QuireIcon name="settings" :size="16" /></QuireIconButton>
          <QuireIconButton :label="locale === 'zh-CN' ? '新对话' : 'New conversation'" size="sm" variant="text" @click="controller.reset()"><QuireIcon name="messageSquarePlus" :size="16" /></QuireIconButton>
          <QuireIconButton :label="locale === 'zh-CN' ? '关闭' : 'Close'" size="sm" variant="text" @click="emit('close')"><QuireIcon name="close" :size="16" /></QuireIconButton>
        </QuireSpace>
      </QuireSpace>
    </header>
    <QuireScrollArea v-if="!messages.length" class="qk-ai-chat__welcome-area" content-class="qk-ai-chat__welcome-content"
      :label="locale === 'zh-CN' ? '文档助手' : 'Document assistant'">
      <Welcome :locale="locale" :disconnected="disconnected" :can-connect="!!controller.options.providerSettings"
        :connection-hint="controller.options.providerStatus?.label[locale]"
        @draft="draftSuggestion" @connect="controller.options.providerSettings?.open()" />
    </QuireScrollArea>
    <QuireChatMessageList v-else :messages="messages" :conversation-id="snapshot.conversationId" height="100%"
      :label="locale === 'zh-CN' ? '对话内容' : 'Conversation'">
      <template #text="{ part }"><QuireMarkdown v-if="part.format === 'markdown'" :content="part.text" :identity="`${snapshot.conversationId}:${part.id}`" :locale="locale" :status="part.state === 'streaming' ? 'receiving' : part.state === 'stopped' ? 'stopped' : part.state === 'error' ? 'error' : 'complete'" /><QuireTypography v-else class="qk-ai-chat__user-text" variant="body">{{ part.text }}</QuireTypography></template>
      <template #custom="{ part }"><DocumentReview v-if="part.name === 'document-review'" :review="asReview(part.data)" :locale="locale" :diagnostics="controller.options.diagnostics === true"
        :locatable="controller.options.locateChange !== undefined" :resolve-image="controller.options.resolveImage" @decide="controller.decidePreview" @locate="controller.options.locateChange?.(asReview(part.data), $event)" /><QuireTypography v-else variant="body">{{ part.fallback }}</QuireTypography></template>
    </QuireChatMessageList>
    <div class="qk-ai-chat__composer-region">
      <QuireChatComposer ref="composer" :model-value="snapshot.draft" label="AI prompt" variant="elevated" density="compact" size="sm" :rows="1"
        :placeholder="locale === 'zh-CN' ? '想写点什么，或修改哪里？' : 'What would you like to write or change?'"
        :busy="snapshot.pending" :submit-disabled="disconnected"
        @update:model-value="controller.setDraft" @submit="controller.submit()" @stop="controller.stop()">
        <template #tools><AuthorizationSelect :locale="locale" :model-value="snapshot.authorizationMode" :disabled="snapshot.pending" :presentation="controller.options.authorizationPresentation" @update:model-value="controller.selectAuthorizationMode" /></template>
        <template #actions>
          <ModelSelect v-if="!disconnected" :models="snapshot.models" :model-value="snapshot.selectedModelId" :locale="locale" :disabled="snapshot.pending" @update:model-value="controller.selectModel" />
          <QuireButton v-else-if="controller.options.providerSettings" size="xs" variant="ghost" @click="controller.options.providerSettings.open()">{{ locale === 'zh-CN' ? '连接模型' : 'Connect model' }}<template #trailing><QuireIcon name="chevronDown" :size="12" /></template></QuireButton>
        </template>
      </QuireChatComposer>
      <QuireTypography as="span" variant="helper" class="qk-ai-chat__connection-status qk-ai-chat__secondary" :data-ai-provider-status="controller.options.providerStatus?.state">
        {{ disconnected ? (locale === 'zh-CN' ? '连接模型后发送，草稿会保留' : 'Connect a model to send. Your draft stays here.') : (locale === 'zh-CN' ? 'Enter 发送 · Shift + Enter 换行' : 'Enter to send · Shift + Enter for a new line') }}
      </QuireTypography>
    </div>
  </section>
</template>
