<script setup lang="ts">
import { computed, getCurrentInstance, shallowRef, watch } from "vue";
import type { QuireKitMenuEntry } from "../../components/menu";
import QuireAvatar from "../avatar/avatar.vue";
import QuireTag from "../tag/tag.vue";
import QuireButton from "../button/button.vue";
import QuireIconButton from "../button/icon-button.vue";
import QuireCard from "../card/card.vue";
import QuireIcon from "../icon/icon.vue";
import QuireMenu from "../menu/menu.vue";
import { useQuireKitLocale, useQuireKitMessages } from "../locale-provider/context";
import QuireTooltipContent from "../tooltip/content.vue";
import QuireTooltipRoot from "../tooltip/root.vue";
import QuireTooltipTrigger from "../tooltip/trigger.vue";
import QuireCommentAction from "./action.vue";
import CommentField from "./field.vue";
import CommentMessage from "./message.vue";
import { formatCommentTime } from "./presentation";
import type { QuireKitCommentMention, QuireKitCommentMessage, QuireKitCommentThreadProps } from "./types";

const props = withDefaults(defineProps<QuireKitCommentThreadProps>(), {
  quoteState: "text", variant: "card", resolved: false, active: false, resolvable: false, replyable: false, busy: false,
});
const emit = defineEmits<{
  /** The card or its quote was chosen; hosts focus the thread and reveal its text. */ activate: [];
  /** Resolve was requested. */ resolve: [];
  /** Reopen was requested. */ reopen: [];
  /** A reply was submitted, with the people mentioned in it. */ reply: [body: string, mentions: readonly QuireKitCommentMention[]];
  /** An edited message was saved, with the people still mentioned. */ edit: [messageId: string, body: string, mentions: readonly QuireKitCommentMention[]];
  /** Deleting a message was requested; the root id means the whole thread. */ delete: [messageId: string];
  /** The previous thread in `position` order was requested. */ previous: [];
  /** The next thread in `position` order was requested. */ next: [];
}>();
defineSlots<{
  /** Formatted message content; defaults to plain text with preserved line breaks. */
  body?: (props: { readonly message: QuireKitCommentMessage }) => unknown;
  /** Replaces the built-in plain-text editor, e.g. with a rich editor; the host saves and cancels through `editingId`. */
  editor?: (props: { readonly message: QuireKitCommentMessage }) => unknown;
  /** Host controls placed before resolve in the card header, usually small icon buttons. */
  actions?: () => unknown;
}>();
/** Message being edited; bind it to own editing, otherwise the card keeps it locally. */
const editing = defineModel<string | null>("editingId", { default: null });
/** Unsent reply; bind it to keep drafts outside the card. */
const reply = defineModel<string>("replyDraft", { default: "" });
/** Whether the reply field is open; bind it together with `replyDraft`. */
const replying = defineModel<boolean>("replyOpen", { default: false });
const text = useQuireKitMessages("comment"), locale = useQuireKitLocale(), instance = getCurrentInstance();
const replyField = shallowRef<InstanceType<typeof CommentField>>(), editDraft = shallowRef("");
/** @returns Whether the host binds the reply draft and therefore clears it itself after a send succeeds. */
const hostOwnsReply = (): boolean => { const bound = instance?.vnode.props ?? {}; return "replyDraft" in bound || "reply-draft" in bound; };
const root = computed(() => props.messages[0]);
const stepping = computed(() => props.active && !!props.position && props.position.total > 1);
const expanded = computed(() => props.active || replying.value || editing.value !== null);
const visible = computed(() => expanded.value ? props.messages : props.messages.slice(0, 1));
const quoteText = computed(() => props.quoteState === "text" ? props.quote ?? "" : props.quoteState === "none" ? ""
  : props.quoteLabel ?? { point: text.value.point, deleted: text.value.quoteDeleted, unavailable: text.value.quoteUnavailable }[props.quoteState]);
const rootActions = computed<readonly QuireKitMenuEntry[]>(() => [
  ...(root.value?.editable && editing.value !== root.value.id ? [{ value: "edit", label: text.value.edit, icon: "edit", disabled: props.busy }] : []),
  ...(root.value?.deletable ? [{ value: "delete", label: text.value.delete, icon: "trash", tone: "danger" as const, disabled: props.busy }] : []),
]);
// A thread that loses focus keeps its reply draft but closes the field when the draft is empty.
watch(() => props.active, active => { if (!active && !reply.value.trim()) replying.value = false; });

/** Activates the card unless the click belongs to a field, link or nested control. @param event - Click inside the card. */
function activateBody(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  if (!props.active && !target.closest("button, a, input, textarea, [contenteditable], [role=menu]")) emit("activate");
}

/** @param message - Message to edit. */
function startEdit(message: QuireKitCommentMessage): void { editing.value = message.id; editDraft.value = message.body; }

/** @param mentions - People still mentioned. Emits the edited text and leaves edit mode. */
function saveEdit(mentions: readonly QuireKitCommentMention[]): void {
  if (editing.value === null || !editDraft.value.trim()) return;
  emit("edit", editing.value, editDraft.value, mentions); editing.value = null;
}

/** @param value - Root menu entry. */
function selectRoot(value: string): void {
  if (!root.value || props.busy) return;
  if (value === "edit") startEdit(root.value);
  else if (value === "delete") emit("delete", root.value.id);
}

/** Submits the reply and clears the field. */
function sendReply(): void {
  if (props.busy || !reply.value.trim()) return;
  emit("reply", reply.value, replyField.value?.mentions() ?? []);
  if (!hostOwnsReply()) { reply.value = ""; replying.value = false; }
}

/** Clears and closes the reply field. */
function cancelReply(): void { reply.value = ""; replying.value = false; }
</script>

<template>
  <QuireCard as="article" :variant="variant === 'plain' ? 'plain' : 'outline'" density="compact" :class="['qk-comment-thread', { 'qk-comment-thread--plain': variant === 'plain' }]" :aria-label="root?.author.name"
    :data-active="active || undefined" :data-resolved="resolved || undefined" @click="activateBody">
    <template #header>
      <div class="qk-comment-thread__header">
        <button type="button" class="qk-comment-thread__target" :aria-current="active ? 'true' : undefined" @click="emit('activate')">
          <QuireAvatar size="xs" :name="root?.author.name ?? ''" :src="root?.author.avatar" />
          <strong class="qk-comment-thread__author">{{ root?.author.name }}</strong>
          <QuireTag v-if="root?.author.badge" size="xs" color="primary">{{ root.author.badge }}</QuireTag>
          <time v-if="root" class="qk-comment-thread__time" :datetime="root.time" :title="root.time">{{ formatCommentTime(root.time, locale) }}</time>
        </button>
        <div class="qk-comment-thread__actions">
          <div v-if="stepping" class="qk-comment-thread__stepper">
            <QuireCommentAction :label="text.previous" icon="chevronUp" @click="emit('previous')" />
            <span class="qk-comment-thread__position" :aria-label="text.position(position!.index, position!.total)">{{ position!.index }} / {{ position!.total }}</span>
            <QuireCommentAction :label="text.next" icon="chevronDown" @click="emit('next')" />
          </div>
          <slot name="actions" />
          <QuireCommentAction v-if="resolvable" :color="resolved ? 'success' : 'neutral'" :variant="resolved ? 'soft' : 'ghost'"
            :disabled="busy" :label="resolved ? text.reopen : text.resolve" icon="circleCheck" :aria-pressed="resolved"
            @click="resolved ? emit('reopen') : emit('resolve')" />
          <QuireTooltipRoot v-if="rootActions.length" placement="top">
            <QuireTooltipTrigger as-child>
              <span class="qk-comment-thread__menu">
                <QuireMenu :aria-label="text.moreActions" :items="rootActions" placement="bottom-end" @select="selectRoot">
                <template #trigger>
                  <QuireIconButton size="xs" :label="text.moreActions"><QuireIcon name="moreHorizontal" /></QuireIconButton>
                </template>
              </QuireMenu>
              </span>
            </QuireTooltipTrigger>
            <QuireTooltipContent :content="text.moreActions" />
          </QuireTooltipRoot>
        </div>
      </div>
    </template>
    <button v-if="quoteState !== 'none'" type="button" class="qk-comment-thread__quote" :data-state="quoteState" :disabled="quoteState === 'unavailable'"
      :title="quoteText" :aria-label="text.goToQuote(quoteText)" @click="emit('activate')">{{ quoteText }}</button>
    <div class="qk-comment-thread__messages">
      <CommentMessage v-for="(message, index) in visible" :key="message.id" :message="message" :root="index === 0" :busy="busy"
        :editing="editing === message.id" :draft="editDraft" :mentions="mentions" @edit="startEdit(message)" @delete="emit('delete', message.id)"
        @update:draft="editDraft = $event" @save="saveEdit" @cancel="editing = null">
        <template v-if="$slots.body" #body="slotProps"><slot name="body" v-bind="slotProps" /></template>
        <template v-if="$slots.editor" #editor="slotProps"><slot name="editor" v-bind="slotProps" /></template>
      </CommentMessage>
    </div>
    <div v-if="!expanded && messages.length > 1">
      <QuireButton variant="ghost" size="xs" @click="emit('activate')">{{ text.replies(messages.length - 1) }}</QuireButton>
    </div>
    <span v-if="resolved" class="qk-comment-thread__resolved"><QuireIcon name="circleCheck" :size="12" />{{ text.resolved }}</span>
    <template v-if="replyable && !resolved && (active || replying)" #footer>
      <div class="qk-comment-thread__composer">
        <CommentField ref="replyField" v-model="reply" :placeholder="text.replyPlaceholder" :label="text.reply" :disabled="busy" :mentions="mentions"
          @focus="replying = true" @submit="sendReply" @cancel="cancelReply" />
        <div v-if="replying" class="qk-comment-thread__composer-actions">
          <small>{{ text.submitHint }}</small>
          <QuireButton variant="ghost" size="xs" :disabled="busy" @click="cancelReply">{{ text.cancel }}</QuireButton>
          <QuireButton color="primary" variant="solid" size="xs" :busy="busy" :disabled="!reply.trim()" @click="sendReply">{{ text.send }}</QuireButton>
        </div>
      </div>
    </template>
  </QuireCard>
</template>
