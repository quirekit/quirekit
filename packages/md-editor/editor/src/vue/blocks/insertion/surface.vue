<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { QuireIconButton, QuireIcon, QuireMenu, QuireTooltipRoot, QuireTooltipTrigger, QuireTooltipContent } from "@quirekit/ui/vue";
import type { SourceInsertionControls } from "@quirekit/msfe-core";
import type { MdEditorLocale } from "../../types";
import { projectMdLayerRect, useMdDocumentLayer, useMdOverlayTarget } from "../../overlays/context";
import { blockLabels } from "../labels";
import { blockInsertionSource } from "./catalog";
import { blockInsertionCommand } from "./command";
import type { MdBlockInsertionRequest, MdBlockInsertionTarget } from "./types";
import InsertList from "./list.vue";
import MobileInsertion from "../../mobile/insertion.vue";
import { useNarrowToolbar } from "../../toolbar/presentation";
import type { MdMentionSource } from "../../../commands/types";
const props = defineProps<{
  /** Current admitted empty source line. */ controls: SourceInsertionControls;
  /** Host-owned menu visibility. */ open: boolean;
  /** Product language. */ locale: MdEditorLocale;
  /** Installed contact capability. */ mentions: boolean;
  /** Actual optional contacts for the mobile parameter page. */ mentionSource?: MdMentionSource | undefined;
}>();
const emit = defineEmits<{
  /** Pin or dismiss this line's insertion menu. */ "update:open": [open: boolean];
  /** Parameterized feature intent, without creating placeholder source. */ insert: [request: MdBlockInsertionRequest];
}>();
const mobile = ref(false), entry = shallowRef<HTMLElement | null>(null), narrow = useNarrowToolbar(() => props.controls.editor);
watch(() => props.open, open => { if (open) mobile.value = narrow.value; }, { immediate: true, flush: "sync" });
const portal = useMdOverlayTarget(), error = ref("");
const label = computed(() => props.locale === "en" ? "Insert at empty line" : "在空行插入");
const menuLabel = computed(() => props.locale === "en" ? "Insert content" : "插入内容");
const target = computed<MdBlockInsertionTarget>(() => ({ controls: props.controls, side: "at" }));
const layer = useMdDocumentLayer();
// Client position anchors the floating menu; the button itself lives in the scrolling document layer.
const position = computed(() => ({ left: Math.max(4, props.controls.rect.left - 30), top: props.controls.rect.top + (props.controls.rect.height - 24) / 2 }));
const local = computed(() => projectMdLayerRect(layer.value, { ...position.value, width: 0, height: 0 }));
/** @param open - Shared menu lifecycle; source is unchanged until selecting a capability. */
function menu(open: boolean): void {
  props.controls.pin(open); emit("update:open", open); error.value = "";
  if (!open && !mobile.value) props.controls.focus();
}
/** @param value - Installed insertion identity from the common catalog. */
function insert(value: string): void {
  const source = blockInsertionSource(props.controls.editor, props.locale, value);
  if (source !== null) {
    if (props.controls.editor.run(blockInsertionCommand(target.value, source), props.controls.target).ok) menu(false);
    else error.value = blockLabels(props.locale).stale;
  } else { emit("insert", { ...target.value, value }); menu(false); }
}
</script>
<template>
  <div ref="entry" class="md-empty-insert" data-md-empty-insert data-qk-not-prose :style="{ left: `${local.left}px`, top: `${local.top}px` }">
    <QuireTooltipRoot :disabled="open" placement="top"><QuireTooltipTrigger as-child>
      <QuireIconButton :label="label" size="xs" color="neutral" variant="outline" :aria-expanded="open" :aria-haspopup="narrow ? 'dialog' : 'menu'"
        class="md-empty-insert__button" @pointerdown.prevent @click="menu(!open)"><QuireIcon name="plus" :size="16" /></QuireIconButton>
    </QuireTooltipTrigger><QuireTooltipContent :content="menuLabel" /></QuireTooltipRoot>
    <QuireMenu v-if="open && !mobile" :portal-target="portal ?? 'body'" :open="true" :anchor-point="{ x: position.left, y: position.top + 26 }"
      placement="bottom-start" width="224px" :aria-label="menuLabel" initial-focus="menu" :close-on-select="false" :lang="locale" @update:open="!$event && menu(false)">
      <InsertList :target="target" :locale="locale" :mentions="mentions" @select="insert" />
      <p v-if="error" role="status" class="m-0 p-qk-inline qk-type-helper text-qk-text-secondary">{{ error }}</p>
    </QuireMenu>
  </div>
  <MobileInsertion v-if="mobile" :editor="controls.editor" :state="controls.editor.state" :locale="locale" :open="open" :target="target" :anchor-el="() => entry" :mentions="mentionSource" @update:open="menu" @insert="emit('insert', $event)" />
</template>
<style scoped>
.md-empty-insert { position: absolute; z-index: 3; pointer-events: auto; }
/* Matches the block handle: hairline edge on the page, fill only on hover. */
.md-empty-insert__button { border-radius: var(--qk-radius-group); border-color: var(--qk-color-border-subtle); background: var(--qk-color-surface-page); box-shadow: none; }
.md-empty-insert__button:hover, .md-empty-insert__button[aria-expanded="true"] { background: var(--qk-color-surface-hover); }
</style>
