<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { QuireButton, QuireCommentDraft, QuireDrawerContent, QuireDrawerRoot, QuireIcon } from "@quirekit/ui/vue";
import type { CommentsController } from "@quirekit/msfe-comments";
import type { QuireKitCommentMention, QuireKitCommentMentionSource, QuireKitCommentPosition } from "@quirekit/ui/vue";
import CommentCard from "./card.vue";
import type { MdCommentAuthor, MdCommentCardModel } from "../types";

const props = defineProps<{
  /** Every thread. */ cards: readonly MdCommentCardModel[];
  /** Focused thread. */ active: string | null;
  /** Comment operations. */ controller: CommentsController;
  /** Whether a draft is open. */ drafting: boolean;
  /** Whether a draft for a comment on the whole document is open here. */ documentDrafting?: boolean;
  /** Label of the button that starts a comment on the whole document; omitted when the user cannot write. */ documentAdd?: string | undefined;
  /** Draft author; absent when the user cannot write. */ author: MdCommentAuthor | undefined;
  /** Draft quote. */ draftQuote: string | undefined;
  /** Bottom sheet on narrow screens. */ narrow: boolean;
  /** People offered after typing @. */ mentions?: QuireKitCommentMentionSource | undefined;
  /** @param id - Thread. @returns Its previous / next position. */ positionOf: (id: string) => QuireKitCommentPosition | undefined;
  /** Product labels. */ labels: { readonly title: string; readonly empty: string; readonly orphaned: string; readonly resolved: string; readonly document: string };
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  /** A card asked to be focused. */ activate: [id: string];
  /** Previous (-1) or next (1) thread was requested. */ step: [direction: 1 | -1];
  /** A thread was resolved from its card. */ resolve: [id: string];
  /** Draft submitted. */ submit: [body: string, mentions: readonly QuireKitCommentMention[]];
  /** Draft abandoned. */ cancel: [];
  /** Document comment draft submitted. */ "submit-document": [body: string, mentions: readonly QuireKitCommentMention[]];
  /** Document comment draft abandoned. */ "cancel-document": [];
  /** A comment on the whole document was requested. */ "add-document": [];
}>();
const list = shallowRef<HTMLElement | null>(null);
/** @returns The draft field, so a new comment can be typed right away; otherwise the drawer's default focus. */
const initialFocus = (): HTMLElement | null => props.drafting || props.documentDrafting ? list.value?.querySelector<HTMLElement>(".qk-comment-draft textarea") ?? null : null;
const groups = computed(() => [
  { key: "document", title: props.labels.document, cards: props.cards.filter(card => !card.resolved && card.view.status === "document") },
  { key: "open", title: "", cards: props.cards.filter(card => !card.resolved && card.view.range) },
  { key: "orphaned", title: props.labels.orphaned, cards: props.cards.filter(card => !card.resolved && card.view.status === "orphaned") },
  { key: "resolved", title: props.labels.resolved, cards: props.cards.filter(card => card.resolved) },
].filter(group => group.cards.length));
</script>

<template>
  <QuireDrawerRoot v-model:open="open" :side="narrow ? 'bottom' : 'end'" :modal="narrow" :initial-focus-el="initialFocus">
    <QuireDrawerContent :title="labels.title" size="small">
      <div ref="list" class="md-editor__comment-list">
        <QuireCommentDraft v-if="drafting" :quote="draftQuote" :author="author" :mentions="mentions"
          @submit="(body, people) => emit('submit', body, people)" @cancel="emit('cancel')" />
        <QuireButton v-if="documentAdd && !documentDrafting" class="justify-self-start" size="sm" variant="outline" @click="emit('add-document')">
          <template #leading><QuireIcon name="messageSquarePlus" /></template>{{ documentAdd }}
        </QuireButton>
        <QuireCommentDraft v-if="documentDrafting" :quote="labels.document" :author="author" :mentions="mentions"
          @submit="(body, people) => emit('submit-document', body, people)" @cancel="emit('cancel-document')" />
        <p v-if="!drafting && !documentDrafting && !cards.length" class="md-editor__comment-empty">{{ labels.empty }}</p>
        <section v-for="group in groups" :key="group.key" class="md-editor__comment-group" :aria-label="group.title || labels.title">
          <h3 v-if="group.title" class="md-editor__comment-group-title">{{ group.title }}</h3>
          <CommentCard v-for="card in group.cards" :key="card.id" :card="card" :active="active === card.id" :controller="controller" :mentions="mentions"
            :position="positionOf(card.id)" @activate="emit('activate', $event)" @step="emit('step', $event)" @resolve="emit('resolve', $event)" />
        </section>
      </div>
    </QuireDrawerContent>
  </QuireDrawerRoot>
</template>

<style scoped>
.md-editor__comment-list, .md-editor__comment-group { display: grid; gap: var(--qk-space-surface-compact); }
.md-editor__comment-list { gap: var(--qk-space-group); }
.md-editor__comment-group-title { margin: 0; color: var(--qk-color-text-tertiary); font: var(--qk-type-helper-font-weight) var(--qk-type-helper-font-size)/var(--qk-type-helper-line-height) var(--qk-type-helper-font-family); }
.md-editor__comment-empty { margin: 0; color: var(--qk-color-text-tertiary); font: var(--qk-type-compact-font-weight) var(--qk-type-compact-font-size)/var(--qk-type-compact-line-height) var(--qk-type-compact-font-family); }
</style>
