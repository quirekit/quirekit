<script setup lang="ts">
import { QuireCommentDraft, QuireCommentRail } from "@quirekit/ui/vue";
import type { CommentsController } from "@quirekit/msfe-comments";
import type { QuireKitCommentMention, QuireKitCommentMentionSource, QuireKitCommentPosition } from "@quirekit/ui/vue";
import CommentCard from "./card.vue";
import type { MdCommentAuthor, MdCommentCardModel } from "../types";

defineProps<{
  /** Positioned items in document order, including an optional `draft`. */ items: readonly { readonly id: string; readonly anchorTop: number }[];
  /** Cards keyed by thread id. */ cards: readonly MdCommentCardModel[];
  /** Focused thread. */ active: string | null;
  /** Comment operations. */ controller: CommentsController;
  /** Draft author; absent when the user cannot write. */ author: MdCommentAuthor | undefined;
  /** Draft quote. */ draftQuote: string | undefined;
  /** People offered after typing @. */ mentions?: QuireKitCommentMentionSource | undefined;
  /** @param id - Thread. @returns Its previous / next position. */ positionOf: (id: string) => QuireKitCommentPosition | undefined;
}>();
const emit = defineEmits<{
  /** Rail element for anchor measurement. */ rail: [element: HTMLElement | null];
  /** A card asked to be focused. */ activate: [id: string];
  /** Previous (-1) or next (1) thread was requested. */ step: [direction: 1 | -1];
  /** A thread was resolved from its card. */ resolve: [id: string];
  /** Draft submitted. */ submit: [body: string, mentions: readonly QuireKitCommentMention[]];
  /** Draft abandoned. */ cancel: [];
}>();
</script>

<template>
  <div>
    <div :ref="element => emit('rail', element as HTMLElement | null)">
      <QuireCommentRail :items="items">
        <template #item="{ item }">
          <QuireCommentDraft v-if="item.id === 'draft'" :quote="draftQuote" :author="author" :mentions="mentions"
            @submit="(body, people) => emit('submit', body, people)" @cancel="emit('cancel')" />
          <CommentCard v-else-if="cards.find(card => card.id === item.id)" :card="cards.find(card => card.id === item.id)!"
            :active="active === item.id" :controller="controller" :mentions="mentions" :position="positionOf(item.id)"
            @activate="emit('activate', $event)" @step="emit('step', $event)" @resolve="emit('resolve', $event)" />
        </template>
      </QuireCommentRail>
    </div>
  </div>
</template>
