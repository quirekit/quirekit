<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { QuireKitMenuEntry } from "../../components/menu";
import QuireAvatar from "../avatar/avatar.vue";
import QuireTag from "../tag/tag.vue";
import QuireButton from "../button/button.vue";
import QuireIconButton from "../button/icon-button.vue";
import QuireCommentAction from "./action.vue";
import QuireTooltipContent from "../tooltip/content.vue";
import QuireTooltipRoot from "../tooltip/root.vue";
import QuireTooltipTrigger from "../tooltip/trigger.vue";
import QuireIcon from "../icon/icon.vue";
import QuireMenu from "../menu/menu.vue";
import { useQuireKitLocale, useQuireKitMessages } from "../locale-provider/context";
import CommentField from "./field.vue";
import { formatCommentTime } from "./presentation";
import type { QuireKitCommentMention, QuireKitCommentMentionSource, QuireKitCommentMessage } from "./types";

const props = defineProps<{
  /** Message to show. */
  readonly message: QuireKitCommentMessage;
  /** Root messages show their author in the card header instead. */
  readonly root: boolean;
  /** Whether this message is being edited. */
  readonly editing: boolean;
  /** Current edit text. */
  readonly draft: string;
  /** Disables actions. */
  readonly busy: boolean;
  /** People offered after typing @. */
  readonly mentions?: QuireKitCommentMentionSource | undefined;
}>();
const emit = defineEmits<{
  /** Starts editing this message. */ edit: [];
  /** Requests deletion. */ delete: [];
  /** Edit text changed. */ "update:draft": [value: string];
  /** Saves the edit with the people still mentioned. */ save: [mentions: readonly QuireKitCommentMention[]];
  /** Abandons the edit. */ cancel: [];
}>();
defineSlots<{
  /** Formatted message content; defaults to plain text with preserved line breaks. */
  body?: (props: { readonly message: QuireKitCommentMessage }) => unknown;
  /** Host editor replacing the built-in plain-text field. */
  editor?: (props: { readonly message: QuireKitCommentMessage }) => unknown;
}>();
const text = useQuireKitMessages("comment"), locale = useQuireKitLocale();
const actions = computed<readonly QuireKitMenuEntry[]>(() => [
  ...(props.message.editable ? [{ value: "edit", label: text.value.edit, icon: "edit", disabled: props.busy }] : []),
  ...(props.message.deletable ? [{ value: "delete", label: text.value.delete, icon: "trash", tone: "danger" as const, disabled: props.busy }] : []),
]);

/** @param value - Chosen menu entry. */
function select(value: string): void {
  if (value === "edit") emit("edit");
  else if (value === "delete") emit("delete");
}

const field = shallowRef<InstanceType<typeof CommentField>>();

/** Saves a nonblank edit. */
function save(): void { if (!props.busy && props.draft.trim()) emit("save", field.value?.mentions() ?? []); }
</script>

<template>
  <div class="qk-comment-message" :data-reply="root ? undefined : ''">
    <div v-if="!root" class="qk-comment-message__header">
      <QuireAvatar size="xs" :name="message.author.name" :src="message.author.avatar" />
      <strong class="qk-comment-message__author">{{ message.author.name }}</strong>
      <QuireTag v-if="message.author.badge" size="xs" color="primary">{{ message.author.badge }}</QuireTag>
      <time class="qk-comment-thread__time" :datetime="message.time" :title="message.time">{{ formatCommentTime(message.time, locale) }}</time>
      <QuireCommentAction v-if="actions.length === 1 && !editing" class="qk-comment-message__more" :disabled="busy" :label="actions[0]!.label" :icon="actions[0]!.icon!"
        @click="select(actions[0]!.value)" />
      <QuireTooltipRoot v-else-if="actions.length && !editing" placement="top">
        <QuireTooltipTrigger as-child>
          <span class="qk-comment-message__menu">
            <QuireMenu :aria-label="text.moreActions" :items="actions" placement="bottom-end" @select="select">
              <template #trigger>
                <QuireIconButton class="qk-comment-message__more" size="xs" :label="text.moreActions"><QuireIcon name="moreHorizontal" /></QuireIconButton>
              </template>
            </QuireMenu>
          </span>
        </QuireTooltipTrigger>
        <QuireTooltipContent :content="text.moreActions" />
      </QuireTooltipRoot>
    </div>
    <div v-if="editing && $slots.editor" class="qk-comment-message__editor"><slot name="editor" :message="message" /></div>
    <div v-else-if="editing" class="qk-comment-message__editor">
      <CommentField ref="field" :model-value="draft" :rows="2" :max-rows="6" :label="text.edit" :disabled="busy" :mentions="mentions"
        :initial-mentions="message.mentions" @update:model-value="emit('update:draft', $event)" @submit="save" @cancel="emit('cancel')" />
      <div class="qk-comment-thread__composer-actions">
        <QuireButton variant="ghost" size="xs" :disabled="busy" @click="emit('cancel')">{{ text.cancel }}</QuireButton>
        <QuireButton color="primary" variant="solid" size="xs" :busy="busy" :disabled="!draft.trim()" @click="save">{{ text.save }}</QuireButton>
      </div>
    </div>
    <div v-else class="qk-comment-message__body">
      <slot name="body" :message="message">{{ message.body }}</slot>
      <span v-if="message.edited" class="qk-comment-message__edited">{{ text.edited }}</span>
    </div>
  </div>
</template>
