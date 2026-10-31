<script setup lang="ts">
import type { QuireDocumentChange } from "@quirekit/ai-runtime";
import type { AiChatImage } from "../types";
import { describeFormatChange, trimKeptText } from "./review-changes";
import ReviewObjects from "./review-objects.vue";

defineProps<{
  /** Block-level changes in document order. */
  readonly changes: readonly QuireDocumentChange[];
  /** Product language. */
  readonly locale: "zh-CN" | "en";
  /** Whether each change can be shown in the document. */
  readonly locatable?: boolean;
  /** Host resolver for the images of changed objects; omitted lists them by name only. */
  readonly resolveImage?: ((source: unknown) => Promise<AiChatImage | null>) | undefined;
}>();
const emit = defineEmits<{
  /** Asks the host to show one change in the document. */
  locate: [change: QuireDocumentChange];
}>();
</script>

<template>
  <ol class="qk-ai-review__changes">
    <li v-for="(change, index) in changes" :key="index" class="qk-ai-review__change" :data-kind="change.kind">
      <component :is="locatable && change.source ? 'button' : 'div'" class="qk-ai-review__entry" :type="locatable && change.source ? 'button' : undefined"
        :title="locatable && change.source ? (locale === 'zh-CN' ? '在文档中查看' : 'Show in document') : undefined" @click="locatable && change.source && emit('locate', change)">
        <span v-if="change.section || (change.kind === 'edited' && !change.text)" class="qk-ai-review__where">
          {{ [change.section, change.kind === 'edited' && !change.text ? change.excerpt || (locale === 'zh-CN' ? '空段落' : 'Empty paragraph') : undefined].filter(Boolean).join(' · ') }}
        </span>
        <span v-if="change.kind !== 'edited'" class="qk-ai-review__what">
          <span class="qk-ai-review__tag">{{ change.kind === 'inserted' ? (locale === 'zh-CN' ? '新增' : 'Added') : (locale === 'zh-CN' ? '删除' : 'Removed') }}</span>
          <component :is="change.kind === 'inserted' ? 'ins' : 'del'" class="qk-ai-review__text">{{ change.excerpt || (locale === 'zh-CN' ? '空段落' : 'Empty paragraph') }}</component>
        </span>
        <span v-if="change.text" class="qk-ai-review__what">
          <template v-for="(piece, pieceIndex) in trimKeptText(change.text)" :key="pieceIndex">
            <del v-if="piece.kind === 'removed'" class="qk-ai-review__text">{{ piece.text }}</del>
            <ins v-else-if="piece.kind === 'inserted'" class="qk-ai-review__text">{{ piece.text }}</ins>
            <span v-else>{{ piece.text }}</span>
          </template>
        </span>
        <span v-if="change.formats.length" class="qk-ai-review__what qk-ai-review__formats">
          {{ change.formats.map(format => describeFormatChange(format, locale)).join(locale === 'zh-CN' ? '；' : '; ') }}
        </span>
      </component>
      <ReviewObjects v-if="resolveImage && change.objects?.length" :objects="change.objects" :locale="locale" :resolve-image="resolveImage" />
    </li>
  </ol>
</template>
