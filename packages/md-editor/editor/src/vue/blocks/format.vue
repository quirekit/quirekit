<script setup lang="ts">
import { computed } from "vue";
import { QuireToolbar, QuireMenuSeparator } from "@quirekit/ui/vue";
import { withSourceOperation, type SourceBlockControls } from "@quirekit/msfe-core";
import { convertMdBlock } from "../../commands/block";
import type { MdEditorLocale } from "../types";
import { blockLabels } from "./labels";
import { blockFormatRows } from "./formats";
// Vue reads an omitted boolean prop as false, so the desktop separator needs an explicit default.
const props = withDefaults(defineProps<{
  /** Explicit captured block; there is no fallback to current caret. */ controls: SourceBlockControls;
  /** Product language. */ locale: MdEditorLocale;
  /** Desktop menu separator; bottom tasks own their own layout. */ divider?: boolean;
}>(), { divider: true });
const emit = defineEmits<{ /** Successful style conversion. */ close: [] }>();
const rows = computed(() => blockFormatRows(props.controls, props.locale));
/** @param kind - One supported conversion. */
function convert(kind: string): void {
  if (props.controls.run(withSourceOperation(convertMdBlock(props.controls.block, kind), { kind: "block.convert", facts: { to: kind } }))) { emit("close"); props.controls.focus(); }
}
</script>
<template>
  <QuireToolbar v-if="rows.length" :label="blockLabels(locale).format" :rows="rows" variant="plain" overflow="visible" align="start" preserve-focus
    class="md-block-format" @execute="convert($event.value)" />
  <QuireMenuSeparator v-if="rows.length && divider" />
</template>
<style scoped>
.md-block-format { --qk-toolbar-surface: transparent; padding: var(--qk-space-inline-tight); }
</style>
