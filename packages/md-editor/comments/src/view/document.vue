<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from "vue";
import { QuireCommentDraft, type QuireKitCommentMention, type QuireKitCommentMentionSource } from "@quirekit/ui/vue";
import type { CommentsController } from "@quirekit/msfe-comments";
import CommentCard from "./card.vue";
import type { MdCommentAuthor, MdCommentCardModel } from "../types";

const props = defineProps<{
  /** Comments on the whole document. */ cards: readonly MdCommentCardModel[];
  /** Focused thread. */ active: string | null;
  /** Comment operations. */ controller: CommentsController;
  /** Set when an entry point asks for a new comment; the input is revealed and focused. */ drafting: boolean;
  /** Current writer; absent when the user cannot write, which hides the input. */ author: MdCommentAuthor | undefined;
  /** People offered after typing @. */ mentions?: QuireKitCommentMentionSource | undefined;
  /** Product labels. */ labels: { readonly title: string; readonly placeholder: string };
}>();
const emit = defineEmits<{
  /** A row asked to be focused. */ activate: [id: string];
  /** A new comment was submitted. */ submit: [body: string, mentions: readonly QuireKitCommentMention[]];
  /** The input took the request to comment. */ focused: [];
  /** A thread was resolved from its row. */ resolve: [id: string];
}>();
const root = shallowRef<HTMLElement | null>(null);
// Open discussions first; resolved ones stay below.
const ordered = computed(() => [...props.cards.filter(card => !card.resolved), ...props.cards.filter(card => card.resolved)]);
watch(() => props.drafting, async drafting => {
  if (!drafting) return;
  await nextTick();
  const field = root.value?.querySelector<HTMLTextAreaElement>(".qk-comment-draft--plain textarea");
  field?.scrollIntoView({ block: "center", behavior: "smooth" }); field?.focus({ preventScroll: true });
  emit("focused");
});
</script>

<template>
  <section v-if="cards.length || author" ref="root" class="md-editor__document-comments" :aria-label="labels.title">
    <!-- Like a document page's comment area: a title and flat rows once there are comments, otherwise just the input. -->
    <h2 v-if="cards.length" class="md-editor__document-comments-title">{{ labels.title }}</h2>
    <div v-if="cards.length" class="md-editor__document-comments-list">
      <CommentCard v-for="card in ordered" :key="card.id" variant="plain" :card="card" :active="active === card.id" :controller="controller" :mentions="mentions"
        @activate="emit('activate', $event)" @resolve="emit('resolve', $event)" />
    </div>
    <QuireCommentDraft v-if="author" variant="plain" :autofocus="false" :placeholder="labels.placeholder" :mentions="mentions"
      @submit="(body, people) => emit('submit', body, people)" />
  </section>
</template>

<style scoped>
.md-editor__document-comments { display: grid; gap: var(--qk-space-surface); margin-block-start: var(--qk-space-section); }
.md-editor__document-comments-title {
  margin: 0; padding-block-end: var(--qk-space-surface-compact); border-block-end: var(--qk-border-width-default) solid var(--qk-color-border-subtle);
  color: var(--qk-color-text-primary); font: var(--qk-type-heading-font-weight) var(--qk-type-heading-font-size)/var(--qk-type-heading-line-height) var(--qk-type-heading-font-family);
}
.md-editor__document-comments-list { display: grid; gap: var(--qk-space-inline-tight); }
</style>
