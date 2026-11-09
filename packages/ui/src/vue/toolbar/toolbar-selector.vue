<script setup lang="ts">
import ToolbarTooltip from "./presentation/tooltip.vue";
import type { ButtonHTMLAttributes } from "vue";
import type { QuireKitToolbarPopup } from "../../components/toolbar/types";
import QuireIcon from "../icon/icon.vue";
import { quireKitEditorIconData } from "../../components/icon/catalog";
import { useToolbarItem } from "./use-toolbar-item";

/** Public properties for one text-value Toolbar selector. */
interface Props {
  /** False delegates native click state to an enclosing Menu or Popover trigger. */
  readonly toggleOnClick?: boolean;
  /** Tooltip explanation; defaults to the accessible label. */
  readonly tooltip?: string | false;
  /** Keys shown beside the tooltip text in reading order; display only. */
  readonly shortcut?: readonly string[];
  /** Reason displayed while this control is unavailable. */
  readonly disabledReason?: string;
  /** Accessible action name. */
  readonly label: string;
  /** Current visible value. */
  readonly text: string;
  /** 展开的浮层类型。 */
  readonly popup?: QuireKitToolbarPopup;
  /** DOM id of the controlled popup when available. */
  readonly controls?: string;
  /** Native button submission behavior. */
  readonly type?: ButtonHTMLAttributes["type"];
  /** Whether activation and keyboard focus are unavailable. */
  readonly disabled?: boolean;
  /** Optional description element for a disabled reason or tooltip detail. */
  readonly describedBy?: string;
}

/** Public events emitted by one Toolbar selector. */
interface Emits {
  /** Emitted with the requested next open state after activation. */
  readonly activate: [expanded: boolean, event: MouseEvent | KeyboardEvent];
}

/** Public slots for one Toolbar selector. */
interface Slots {
  /** Optional leading icon component, normally QuireIcon. */
  readonly default?: () => unknown;
  /** 自定义展开图标。 */
  readonly indicator?: () => unknown;
}

const {
  label,
  toggleOnClick = true,
  text,
  popup = "menu",
  controls,
  type = "button",
  disabled = false,
  describedBy,
  tooltip = undefined,
  shortcut,
  disabledReason
} = defineProps<Props>();
const emit = defineEmits<Emits>();
defineSlots<Slots>();
defineOptions({ inheritAttrs: false });
const expanded = defineModel<boolean>("expanded", { default: false });
const item = useToolbarItem(() => disabled);

/** @param event - Native activation requesting the opposite Menu-owned disclosure state. */
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
/** @param event - A popup opening key; an enclosing Menu may already have handled it. */
function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.key !== "ArrowDown" || disabled) return;
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
  <ToolbarTooltip :trigger-id="typeof $attrs.id === 'string' ? $attrs.id : item.id" :label="label" :tooltip="tooltip" :shortcut="shortcut" :disabled-reason="disabledReason" :subject-disabled="disabled" :suppressed="expanded">
  <button
    :id="item.id"
    v-bind="$attrs"
    :title="undefined"
    :ref="(element) => { item.element.value = element as HTMLButtonElement | null }"
    :type="type"
    class="qk-toolbar__item qk-toolbar__disclosure min-w-0"
    :aria-label="label"
    :aria-describedby="describedBy"
    :aria-controls="controls ?? (typeof $attrs['aria-controls'] === 'string' ? $attrs['aria-controls'] : undefined)"
    :aria-expanded="expanded"
    :aria-haspopup="popup"
    :aria-disabled="disabled ? 'true' : undefined"
    :tabindex="item.tabIndex.value"
    :data-qk-toolbar-item="item.id"
    :data-state="expanded ? 'open' : 'closed'"
    data-kind="selector"
    @focus="item.handleFocus"
    @click.capture="guardDisabledActivation"
    @click="activate"
    @keydown="handleKeydown"
  >
    <span v-if="$slots.default" class="qk-toolbar__icon" aria-hidden="true">
      <slot />
    </span>
    <span class="qk-toolbar__label">{{ text }}</span>
    <span class="qk-toolbar__indicator" aria-hidden="true">
      <slot name="indicator">
        <QuireIcon :data="quireKitEditorIconData.chevronDown" />
      </slot>
    </span>
  </button>
  </ToolbarTooltip>
</template>
