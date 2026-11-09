<script setup lang="ts">
import { computed, inject, shallowRef } from "vue";
import { QuireChoicePicker, QuireSelect, QuireToolbarField, QuireToolbarSelector, type QuireKitToolbarRendererScope } from "@quirekit/ui/vue";
import type { QuireKitChoiceSubmitRequest } from "@quirekit/ui";
import type { MdToolbarContext } from "./types";
import { mdEditorMessages } from "../messages";
import { mdNarrowKey } from "../context";
import { useNarrowToolbar } from "./presentation";
const props = defineProps<{
  /** Public toolbar field state and original execution bridge. */ scope: QuireKitToolbarRendererScope;
}>();
const items = computed(() => (props.scope.item.items ?? []).map(item => ({ value: item.value, label: item.label,
  ...(item.shortcut ? { shortcut: typeof item.shortcut === "string" ? [item.shortcut] : item.shortcut } : {}) })));
const narrow = inject(mdNarrowKey, () => useNarrowToolbar(() => (props.scope.context as MdToolbarContext).editor), true);
// Desktop keeps the compact select; narrow screens use the adaptive bottom panel.
// The presentation stays fixed while a panel is open so a resize cannot swap it mid-task.
const mobileOpen = shallowRef(false);
const mobile = computed<boolean>(previous => props.scope.expanded || mobileOpen.value ? previous ?? narrow.value : narrow.value);
let committed = false;
/** @param request - One selection accepted by the public picker. */
function submit(request: QuireKitChoiceSubmitRequest): void {
  const context = props.scope.context as MdToolbarContext, value = request.value[0];
  if (request.signal.aborted || props.scope.disabled || !context.anchor?.target() || !items.value.some(item => item.value === value)) {
    throw new Error(mdEditorMessages[context.locale].conflict);
  }
  // The Toolbar's captured source intent remains authoritative after the panel takes focus.
  props.scope.execute(value);
  if (!context.editor.lastCommandResult?.ok) throw new Error(mdEditorMessages[context.locale].rejected);
  committed = true;
}
/** @returns Document input after a write, otherwise the picker's default trigger focus. */
function finalFocus(): HTMLElement | null {
  return committed ? (props.scope.context as MdToolbarContext).editor.element.querySelector<HTMLElement>('[role="textbox"]') : null;
}
</script>
<template>
  <QuireToolbarField :label="scope.item.label" :tooltip="false" :disabled="scope.disabled" :expanded="scope.expanded" width="140px">
    <template #default="{ size }">
      <QuireSelect v-if="!mobile" width="100%" content-width="160px" :size="size" :label="scope.item.label" :disabled="scope.disabled"
        :items="items" :model-value="String(scope.item.payload)" :open="scope.expanded"
        @update:open="scope.setExpanded($event === true)" @update:model-value="$event !== undefined && scope.execute($event)" />
      <QuireChoicePicker v-else :title="scope.item.label" :disabled="scope.disabled" :items="items" :model-value="[String(scope.item.payload)]"
        presentation="bottom" :open="scope.expanded" :submit="submit" :final-focus-el="finalFocus"
        @update:open="scope.setExpanded" @open-change="open => { mobileOpen = open; if (open) committed = false; }">
        <template #trigger="{ open, disabled }">
          <QuireToolbarSelector :label="scope.item.label" :text="scope.item.text ?? ''" :disabled="disabled" :expanded="open"
            :toggle-on-click="false" popup="dialog" class="w-full" @update:expanded="scope.setExpanded" />
        </template>
      </QuireChoicePicker>
    </template>
  </QuireToolbarField>
</template>
