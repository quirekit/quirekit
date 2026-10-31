<script setup lang="ts">
import { QuireCommentThread, type QuireKitCommentMention, type QuireKitCommentMentionSource, type QuireKitCommentPosition } from "@quirekit/ui/vue";
import { CommentBody } from "./body";
import type { CommentsController } from "@quirekit/msfe-comments";
import type { MdCommentCardModel } from "../types";

const props = defineProps<{
  /** Card model. */ card: MdCommentCardModel;
  /** Whether the thread is focused. */ active: boolean;
  /** Comment operations. */ controller: CommentsController;
  /** People offered after typing @. */ mentions?: QuireKitCommentMentionSource | undefined;
  /** Place among the threads a reader steps through; shows previous / next on the active card. */ position?: QuireKitCommentPosition | undefined;
  /** `plain` shows a flat row without the quote line, as in a list of comments on the whole document. */ variant?: "card" | "plain";
}>();
const emit = defineEmits<{
  /** The card asked to be focused. */ activate: [id: string];
  /** Previous (-1) or next (1) thread was requested. */ step: [direction: 1 | -1];
  /** Resolving this thread was requested; the host moves on to the next one. */ resolve: [id: string];
}>();

/** @param mentions - People chosen in the field. @returns Persisted identities, without picker-only fields. */
const people = (mentions: readonly QuireKitCommentMention[]) => mentions.map(({ id, label, url }) => ({ id, label, url }));

/** @param messageId - Message to delete; the root deletes the thread. */
function remove(messageId: string): void { props.controller.remove(props.card.id, messageId); }
</script>

<template>
  <QuireCommentThread :messages="card.messages" :quote="card.quote" :quote-state="variant === 'plain' ? 'none' : card.quoteState" :quote-label="card.quoteLabel" :variant="variant" :resolved="card.resolved" :active="active"
    :resolvable="card.resolvable" :replyable="card.replyable" :mentions="mentions" :position="position" :data-md-comment="card.id"
    @activate="emit('activate', card.id)" @previous="emit('step', -1)" @next="emit('step', 1)" @resolve="emit('resolve', card.id)" @reopen="controller.reopen(card.id)"
    @reply="(body, mentions) => controller.reply(card.id, { body, mentions: people(mentions) })"
    @edit="(id, body, mentions) => controller.edit(card.id, id, { body, mentions: people(mentions) })" @delete="remove">
    <template #body="{ message }"><CommentBody class="md-comment-body" :body="message.body" /></template>
  </QuireCommentThread>
</template>

<style scoped>
.md-comment-body :deep(.md-comment-link), .md-comment-body :deep(.md-comment-mention) { color: var(--qk-color-action-primary); text-decoration: none; }
.md-comment-body :deep(.md-comment-link:hover) { text-decoration: underline; }
.md-comment-body :deep(code) { padding: 0 2px; border-radius: var(--qk-radius-control); background: var(--qk-color-surface-subtle); font-family: var(--qk-type-code-font-family); font-size: .92em; }
</style>
