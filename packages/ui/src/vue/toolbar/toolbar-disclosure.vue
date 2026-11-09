<script setup lang="ts">
import ToolbarTooltip from "./presentation/tooltip.vue";
import QuireIcon from "../icon/icon.vue";
import { quireKitEditorIconData } from "../../components/icon/catalog";
import type { ButtonHTMLAttributes } from "vue";
import type { QuireKitToolbarPopup } from "../../components/toolbar/types";
import { useToolbarItem } from "./use-toolbar-item";

/** Public properties for one Toolbar disclosure button. */
interface Props {
  /** False delegates native click state to an enclosing Menu or Popover trigger. */
  readonly toggleOnClick?: boolean;
  /** Tooltip explanation; defaults to the accessible label. */
  readonly tooltip?: string | false;
  /** Keys shown beside the tooltip text in reading order; display only. */
  readonly shortcut?: readonly string[];
  /** Reason displayed while this control is unavailable. */
  readonly disabledReason?: string;
  /** Show a compact indicator beside the icon or visible label. */
  readonly indicator?: boolean;
  /** Accessible action name. */
  readonly label: string;
  /** Popup type; false keeps persistent-panel semantics and its Tooltip while expanded. */
  readonly popup?: QuireKitToolbarPopup | false;
  /** DOM id of the controlled popup when available. */
  readonly controls?: string;
  /** Optional visible action label rendered beside the icon. */
  readonly text?: string;
  /** Native button submission behavior. */
  readonly type?: ButtonHTMLAttributes["type"];
  /** Whether activation and keyboard focus are unavailable. */
  readonly disabled?: boolean;
  /** Optional description element for a disabled reason or tooltip detail. */
  readonly describedBy?: string;
}

/** Public events emitted by one Toolbar disclosure. */
interface Emits {
  /** Emitted with the requested next open state after activation. */
  readonly activate: [expanded: boolean, event: MouseEvent | KeyboardEvent];
}

/** Public slots for one Toolbar disclosure. */
interface Slots {
  /** Leading icon component, normally QuireIcon. */
  readonly default: () => unknown;
  /** Disclosure indicator component, normally a directional QuireIcon. */
  readonly indicator?: () => unknown;
}

const {
  label,
  toggleOnClick = true,
  popup = "menu",
  controls,
  text,
  type = "button",
  disabled = false,
  describedBy,
  tooltip = undefined,
  shortcut,
  disabledReason,
  indicator = false
} = defineProps<Props>();
const emit = defineEmits<Emits>();
defineSlots<Slots>();
defineOptions({ inheritAttrs: false });
const expanded = defineModel<boolean>("expanded", { default: false });
const item = useToolbarItem(() => disabled);

/** @param event - Native activation requesting the opposite disclosure state. */
function activate(event: MouseEvent): void {
  if (disabled) {
    event.preventDefault();
    return;
  }
  if (!toggleOnClick) return;
  const next = !expanded.value;
  expanded.value = next;
  emit("activate", next, event);
}
/** @param event - ArrowDown requests opening a popup; navigation remains with the popup owner. */
function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.key !== "ArrowDown" || popup === false || disabled) return;
  event.preventDefault();
  if (expanded.value) return;
  expanded.value = true;
  emit("activate", true, event);
}
/** @param event - Block unavailable commands before any enclosing machine sees their click. */
function guardDisabledActivation(event: MouseEvent): void {
  if (!disabled) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}
</script>

<template>
  <ToolbarTooltip :trigger-id="typeof $attrs.id === 'string' ? $attrs.id : item.id" :label="label" :tooltip="tooltip" :shortcut="shortcut" :disabled-reason="disabledReason" :subject-disabled="disabled" :suppressed="expanded && popup !== false">
  <button
    :id="item.id"
    v-bind="$attrs"
    :title="undefined"
    :ref="(element) => { item.element.value = element as HTMLButtonElement | null }"
    :type="type"
    :class="[
      'qk-toolbar__item',
      text === undefined && !indicator && !$slots.indicator && 'qk-toolbar__icon-button',
      text !== undefined && 'qk-toolbar__disclosure'
    ]"
    :aria-label="label"
    :aria-describedby="describedBy"
    :aria-controls="controls ?? (typeof $attrs['aria-controls'] === 'string' ? $attrs['aria-controls'] : undefined)"
    :aria-expanded="expanded"
    :aria-haspopup="popup || undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    :tabindex="item.tabIndex.value"
    :data-qk-toolbar-item="item.id"
    :data-state="expanded ? 'open' : 'closed'"
    data-kind="disclosure"
    @focus="item.handleFocus"
    @click.capture="guardDisabledActivation"
    @click="activate"
    @keydown="handleKeydown"
  >
    <span v-if="$slots.default" class="qk-toolbar__icon" aria-hidden="true"><slot /></span>
    <span v-if="text !== undefined" class="qk-toolbar__label">{{ text }}</span>
    <span
      v-if="$slots.indicator || indicator"
      class="qk-toolbar__indicator"
      aria-hidden="true"
    >
      <slot name="indicator"><QuireIcon :data="quireKitEditorIconData.chevronDown" /></slot>
    </span>
  </button>
  </ToolbarTooltip>
</template>
