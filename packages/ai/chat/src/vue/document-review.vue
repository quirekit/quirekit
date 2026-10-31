<script setup lang="ts">
import { computed } from "vue";
import { QuireChatConfirmation, QuireCollapsible, QuireDiffViewer, QuireSpace, QuireTypography } from "@quirekit/ui/vue";
import type { QuireKitChatConfirmationDecision } from "@quirekit/ui";
import type { QuireDocumentChange } from "@quirekit/ai-runtime";
import type { AiChatImage, AiChatReview, AiChatEditPreviewDecision } from "../types";
import { createReviewDiff } from "./review-diff";
import ReviewChangeList from "./review-change-list.vue";

const props = defineProps<{
  /** Complete SDK-owned candidate and decision history. */
  readonly review: AiChatReview;
  /** Product language. */
  readonly locale: "zh-CN" | "en";
  /** Shows the raw view and structure differences for developers. */
  readonly diagnostics?: boolean;
  /** Whether listed changes can be shown in the document. */
  readonly locatable?: boolean;
  /** Host resolver for the images of changed objects. */
  readonly resolveImage?: ((source: unknown) => Promise<AiChatImage | null>) | undefined;
}>();
const emit = defineEmits<{
  /** User intent; the SDK revalidates before committing. */
  decide: [id: string, decision: AiChatEditPreviewDecision];
  /** Asks the host to show one change in the document. */
  locate: [change: QuireDocumentChange];
}>();
const zh = computed(() => props.locale === "zh-CN");
const changes = computed(() => props.review.preview.changes);
const decided = computed(() => props.review.state !== "pending");
const title = computed(() => {
  const count = changes.value?.length;
  if (count === undefined || count === 0) return zh.value ? "审阅修改" : "Review changes";
  return zh.value ? `${count} 处修改` : `${count} ${count === 1 ? "change" : "changes"}`;
});
const textDiff = computed(() => createReviewDiff(props.review.preview.sourceText, props.review.preview.candidateText));
const viewDiff = computed(() => {
  const { sourceView, candidateView } = props.review.preview;
  return sourceView === undefined || candidateView === undefined ? "" : createReviewDiff(sourceView, candidateView);
});
const structureDiff = computed(() => props.diagnostics
  ? createReviewDiff(JSON.stringify(props.review.preview.sourceDocument, null, 2), JSON.stringify(props.review.preview.candidateDocument, null, 2))
  : "");
/** Forward a decision without presenting it as a successful commit.
 * @param details - Public confirmation intent.
 */
function decide(details: QuireKitChatConfirmationDecision): void {
  emit("decide", details.requestId, details.decision === "approve" ? "approved" : "rejected");
}
</script>

<template>
  <section class="qk-ai-review" data-ai-edit-preview="true" role="region" :aria-label="zh ? 'AI 修改预览' : 'AI edit preview'">
    <QuireChatConfirmation :request-id="review.preview.id" :state="review.state" :title="title" intent="review" @decide="decide">
      <QuireSpace orientation="vertical" gap="surfaceCompact">
        <template v-if="changes && changes.length">
          <QuireCollapsible v-if="decided" variant="plain" trigger-variant="text" indicator-placement="inline" :title="zh ? '查看修改' : 'Show changes'">
            <ReviewChangeList :changes="changes" :locale="locale" :locatable="locatable" :resolve-image="resolveImage" @locate="emit('locate', $event)" />
          </QuireCollapsible>
          <ReviewChangeList v-else :changes="changes" :locale="locale" :locatable="locatable" :resolve-image="resolveImage" @locate="emit('locate', $event)" />
        </template>
        <template v-else-if="!decided">
          <QuireDiffViewer v-if="textDiff" :patch="textDiff" :label="zh ? '文本差异' : 'Text changes'" :max-height="240" />
          <QuireTypography v-else variant="helper" class="qk-ai-chat__secondary">{{ zh ? '文本未变化，只调整了格式或结构。' : 'Text is unchanged; only formatting or structure changed.' }}</QuireTypography>
        </template>
        <QuireCollapsible v-if="diagnostics" variant="plain" trigger-variant="text" indicator-placement="inline" :title="zh ? '开发者：原始差异' : 'Developer: raw differences'">
          <QuireSpace orientation="vertical" gap="surfaceCompact">
            <QuireDiffViewer v-if="viewDiff" :patch="viewDiff" :label="zh ? 'AI 视图差异' : 'AI view changes'" :max-height="240" />
            <QuireDiffViewer :patch="structureDiff" :label="zh ? '结构差异' : 'Structure changes'" :max-height="240" />
          </QuireSpace>
        </QuireCollapsible>
      </QuireSpace>
    </QuireChatConfirmation>
  </section>
</template>
