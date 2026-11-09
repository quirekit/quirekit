<script setup lang="ts">
import { computed, inject } from "vue";
import { toolbarLabelsKey } from "../context";
import type { QuireKitToolbarEntry, QuireKitToolbarExecuteEvent, QuireKitToolbarOpenChangeEvent } from "../../../components/toolbar/types";
import type { QuireKitToolbarRendererScope, QuireKitToolbarRenderers } from "./types";
import QuireIcon from "../../icon/icon.vue";
import QuireMenu from "../../menu/menu.vue";
import QuirePopoverRoot from "../../popover/root.vue";
import QuirePopoverTrigger from "../../popover/trigger.vue";
import QuireToolbarAction from "../toolbar-action.vue";
import QuireToolbarToggle from "../toolbar-toggle.vue";
import QuireToolbarSelector from "../toolbar-selector.vue";
import QuireToolbarDisclosure from "../toolbar-disclosure.vue";
import QuireToolbarSplitButton from "../toolbar-split-button.vue";
import PopupBody from "./popup-body.vue";
import { useToolbarEntry } from "./use-entry";
import { quireKitEditorIconData } from "../../../components/icon/catalog";
const props = defineProps<{
  /** Current entry. */
  item: QuireKitToolbarEntry;
  /** Full identity path. */
  path: readonly string[];
  /** Enclosing group availability. */
  disabled: boolean;
  /** Host context delivered unchanged. */
  context: unknown;
  /** Named application renderers. */
  renderers: QuireKitToolbarRenderers;
}>();
defineSlots<{
  /** Custom toolbar control fallback. */
  item?: (scope: QuireKitToolbarRendererScope) => unknown;
  /** Custom popup body fallback. */
  content?: (scope: QuireKitToolbarRendererScope) => unknown;
}>();
const emit = defineEmits<{
  /** Accepted command request. */
  execute: [event: QuireKitToolbarExecuteEvent];
  /** Popup state request. */
  openChange: [event: QuireKitToolbarOpenChangeEvent];
}>();
const { unavailable, expanded, setExpanded, dispatch, scope } = useToolbarEntry(
  () => props, event => emit("execute", event), event => emit("openChange", event)
);
const hasIcon = computed(() => !!(props.item.icon || props.item.iconData));
const showLabels = inject(toolbarLabelsKey);
const common = computed(() => ({
  ...props.item.attributes, label: props.item.label, disabled: unavailable.value,
  ...(props.item.tooltip === undefined ? {} : { tooltip: props.item.tooltip }),
  ...(props.item.shortcut === undefined ? {} : { shortcut: props.item.shortcut }),
  ...(props.item.disabledReason === undefined ? {} : { disabledReason: props.item.disabledReason }),
  ...(props.item.describedBy === undefined ? {} : { describedBy: props.item.describedBy })
}));
const text = computed(() => props.item.text !== undefined || !hasIcon.value || showLabels?.value ? { text: props.item.text ?? props.item.label } : {});
const menuProps = computed(() => {
  const { contentAttributes, ...surface } = props.item.overlayProps ?? {};
  return { ...surface, ...contentAttributes };
});
</script>
<template>
  <template v-if="item.kind === 'custom'">
    <component v-if="item.renderer && renderers[item.renderer]" :is="renderers[item.renderer]" :scope="scope" />
    <slot v-else name="item" v-bind="scope" />
  </template>
  <QuireMenu v-else-if="item.kind === 'menu'" v-bind="menuProps" :open="expanded" @update:open="setExpanded($event === true)"
    :aria-label="item.label" :items="item.items ?? []" @select="dispatch('menu', item.payload, $event)">
    <template #trigger>
      <QuireToolbarDisclosure :toggle-on-click="false" v-if="item.trigger === 'disclosure'" v-bind="{ ...common, ...text }" :indicator="item.indicator ?? true"
        :expanded="expanded" @update:expanded="setExpanded">
        <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
      </QuireToolbarDisclosure>
      <QuireToolbarSelector :toggle-on-click="false" v-else v-bind="common" :text="item.text ?? item.label" :expanded="expanded" @update:expanded="setExpanded">
        <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
      </QuireToolbarSelector>
    </template>
  </QuireMenu>
  <QuireToolbarSplitButton v-else-if="item.kind === 'split'" :label="item.label"
    v-bind="{ ...item.attributes, ...text, ...(item.pressed === undefined ? {} : { pressed: item.pressed }),
      ...(item.actionTooltip === undefined && item.tooltip === undefined ? {} : { actionTooltip: item.actionTooltip ?? item.tooltip }),
      ...(item.disclosureTooltip === undefined && item.tooltip === undefined ? {} : { disclosureTooltip: item.disclosureTooltip ?? item.tooltip }),
      ...(item.disabledReason === undefined ? {} : { disabledReason: item.disabledReason }) }"
    :action-label="item.actionLabel ?? item.label" :disclosure-label="item.disclosureLabel ?? item.label"
    :disabled="unavailable" :action-disabled="item.actionDisabled ?? false" :disclosure-disabled="item.disclosureDisabled ?? false"
    overlay="popover" popup="dialog" :expanded="expanded" @update:expanded="setExpanded" @action="dispatch('action', item.payload, item.value, undefined, $event)">
    <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
    <template v-if="item.items !== undefined" #disclosure>
      <QuireMenu v-bind="menuProps" :open="expanded" :aria-label="item.disclosureLabel ?? item.label"
        :items="item.items" @update:open="setExpanded($event === true)" @select="dispatch('menu', item.payload, $event)">
        <template #trigger>
          <QuireToolbarDisclosure :toggle-on-click="false" class="qk-toolbar__split-disclosure"
            v-bind="{ ...common, label: item.disclosureLabel ?? item.label, tooltip: item.disclosureTooltip ?? item.tooltip ?? item.disclosureLabel ?? item.label }"
            popup="menu" :expanded="expanded" :disabled="unavailable || !!item.disclosureDisabled" @update:expanded="setExpanded">
            <QuireIcon :data="quireKitEditorIconData.chevronDown" />
          </QuireToolbarDisclosure>
        </template>
      </QuireMenu>
    </template>
    <template #overlay><PopupBody :scope="scope" :renderers="renderers"><template v-if="$slots.content" #content="body"><slot name="content" v-bind="body" /></template></PopupBody></template>
  </QuireToolbarSplitButton>
  <QuireToolbarDisclosure v-else-if="item.kind === 'disclosure' && !item.contentRenderer && !$slots.content"
    v-bind="{ ...common, ...text }" :indicator="item.indicator ?? false" :popup="item.popup ?? 'dialog'" :expanded="expanded" @update:expanded="setExpanded" @activate="(_open, event) => dispatch('action', item.payload, item.value, undefined, event)">
    <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
  </QuireToolbarDisclosure>
  <QuirePopoverRoot v-else-if="item.kind === 'selector' || item.kind === 'disclosure'" :open="expanded"
    :restore-focus="item.overlayProps?.restoreFocus ?? true" @update:open="setExpanded">
    <QuirePopoverTrigger as-child>
      <QuireToolbarSelector :toggle-on-click="false" v-if="item.kind === 'selector'" v-bind="common" :text="item.text ?? item.label"
        popup="dialog" :expanded="expanded" @update:expanded="setExpanded" :disabled="unavailable || !!item.disclosureDisabled">
        <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
      </QuireToolbarSelector>
      <QuireToolbarDisclosure :toggle-on-click="false" v-else v-bind="{ ...common, ...text }" :indicator="item.indicator ?? false" :popup="item.popup ?? 'dialog'" :expanded="expanded" @update:expanded="setExpanded"
        :disabled="unavailable || !!item.disclosureDisabled">
        <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
      </QuireToolbarDisclosure>
    </QuirePopoverTrigger>
    <PopupBody :scope="scope" :renderers="renderers"><template v-if="$slots.content" #content="body"><slot name="content" v-bind="body" /></template></PopupBody>
  </QuirePopoverRoot>
  <!-- A model listener keeps Vue controlled; activate carries the original event and emits the sole intent. -->
  <QuireToolbarToggle v-else-if="item.kind === 'toggle'" v-bind="{ ...common, ...text }"
    :model-value="item.pressed ?? false" @update:model-value="() => {}"
    @activate="(pressed, event) => dispatch('toggle', item.payload, item.value, pressed, event)">
    <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
  </QuireToolbarToggle>
  <QuireToolbarAction v-else v-bind="{ ...common, ...text }" @activate="dispatch('action', item.payload, item.value, undefined, $event)">
    <template v-if="hasIcon" #default><QuireIcon :name="item.icon" :data="item.iconData" :accent-color="item.iconAccentColor" :empty="item.iconEmpty" /></template>
  </QuireToolbarAction>
</template>
