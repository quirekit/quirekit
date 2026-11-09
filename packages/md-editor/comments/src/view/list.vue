<script setup lang="ts">
import { computed, shallowRef, useAttrs, type ComponentPublicInstance } from "vue";
import { QuireDrawerContent, QuireDrawerRoot, QuireIcon, QuireIconButton } from "@quirekit/ui/vue";
import ListContent from "./list-content.vue";
import type { MdCommentListPresentation } from "../types";

defineOptions({ inheritAttrs: false });
const props = defineProps<{
  /** Docked in the rail column, a side drawer that leaves the page usable, or a mobile bottom sheet. */ presentation: MdCommentListPresentation;
  /** List title. */ title: string;
  /** Accessible label of the docked close button. */ closeLabel: string;
  /** Whether a draft is open. */ drafting: boolean;
  /** Whether a draft for a comment on the whole document is open here. */ documentDrafting?: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
/** Everything else, including the event listeners, belongs to the list content. */
const contentProps = useAttrs() as unknown as InstanceType<typeof ListContent>["$props"];
const content = shallowRef<ComponentPublicInstance | null>(null);
const sheet = computed(() => props.presentation === "sheet");
/** @returns The draft field, so a new comment can be typed right away; otherwise the drawer's default focus. */
const initialFocus = (): HTMLElement | null => props.drafting || props.documentDrafting ? (content.value?.$el as HTMLElement | undefined)?.querySelector<HTMLElement>(".qk-comment-draft textarea") ?? null : null;
</script>

<template>
  <section v-if="presentation === 'dock'" class="md-editor__comment-dock" :aria-label="title">
    <header class="md-editor__comment-dock-header">
      <h2 class="md-editor__comment-dock-title">{{ title }}</h2>
      <QuireIconButton :label="closeLabel" size="sm" variant="ghost" @click="open = false"><QuireIcon name="close" :size="16" /></QuireIconButton>
    </header>
    <div class="md-editor__comment-dock-body">
      <ListContent v-bind="contentProps" :drafting="drafting" :document-drafting="documentDrafting" />
    </div>
  </section>
  <QuireDrawerRoot v-else v-model:open="open" :side="sheet ? 'bottom' : 'end'" :modal="sheet" :initial-focus-el="initialFocus">
    <QuireDrawerContent :title="title" size="small" :show-backdrop="sheet">
      <ListContent ref="content" v-bind="contentProps" :drafting="drafting" :document-drafting="documentDrafting" />
    </QuireDrawerContent>
  </QuireDrawerRoot>
</template>

<style scoped>
/* Stays in view while the document scrolls; hosts with their own scroller set --md-editor-viewport-height to its height. */
.md-editor__comment-dock {
  position: sticky; top: calc(var(--md-editor-toolbar-top, 0px) + var(--md-editor-toolbar-height, 0px));
  display: grid; grid-template-rows: auto minmax(0, 1fr);
  max-height: calc(var(--md-editor-viewport-height, 100vh) - var(--md-editor-toolbar-top, 0px) - var(--md-editor-toolbar-height, 0px));
  background: var(--qk-color-surface-page);
}
.md-editor__comment-dock-header { display: flex; align-items: center; justify-content: space-between; padding-block: var(--qk-space-surface-compact); }
.md-editor__comment-dock-title { margin: 0; color: var(--qk-color-text-primary); font: var(--qk-type-heading-font-weight) var(--qk-type-heading-font-size)/var(--qk-type-heading-line-height) var(--qk-type-heading-font-family); }
.md-editor__comment-dock-body { min-height: 0; overflow-y: auto; padding-block-end: var(--qk-space-group); }
</style>
