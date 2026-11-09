<script setup lang="ts">
import { computed } from "vue";
import { QuireDialogContent, QuireDialogRoot, QuireKbd } from "@quirekit/ui/vue";
import { mdEditorMessages } from "../messages";
import type { MdEditorLocale } from "../types";
import { mdShortcutGroups } from "./table";
import { displayKeys, macKeys } from "./keys";
import type { MdShortcut } from "./types";

const props = defineProps<{
  /** Whether the reference is shown. */ open: boolean;
  /** Label language. */ locale: MdEditorLocale;
  /** Whether comment shortcuts apply. */ comments?: boolean;
  /** Whether the block handle menu shortcut applies. */ blockMenu?: boolean;
}>();
const emit = defineEmits<{ /** Requested visibility. */ "update:open": [open: boolean] }>();
const text = computed(() => mdEditorMessages[props.locale]);
const groups = computed(() => mdShortcutGroups(props.locale, { comments: props.comments, blockMenu: props.blockMenu }));

/** @param item - Documented binding. @returns Platform keys in reading order, one cap each. */
function keys(item: MdShortcut): string[] {
  return displayKeys(macKeys ? item.mac ?? item.key : item.key);
}
</script>

<template>
  <QuireDialogRoot :open="open" @update:open="emit('update:open', $event)">
    <QuireDialogContent :title="text.shortcuts" size="large" data-qk-not-prose>
      <div class="grid gap-x-10 gap-y-6 md:grid-cols-3">
        <section v-for="group in groups" :key="group.title" class="min-w-0">
          <h3 class="qk-type-helper text-qk-text-secondary mb-3">{{ group.title }}</h3>
          <dl class="m-0">
            <div v-for="item in group.items" :key="item.id" class="flex items-center justify-between gap-qk-inline py-1.5">
              <dt class="qk-type-compact min-w-0 truncate">{{ item.label }}</dt>
              <dd class="m-0 flex shrink-0 items-center gap-1"><QuireKbd v-for="(key, index) in keys(item)" :key="index" :keys="[key]" size="sm" /></dd>
            </div>
          </dl>
        </section>
      </div>
    </QuireDialogContent>
  </QuireDialogRoot>
</template>
