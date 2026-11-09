<script setup lang="ts">
import ToolbarTooltip from "./presentation/tooltip.vue";
import type { ButtonHTMLAttributes } from "vue";
import type { QuireKitToolbarToggleState } from "../../components/toolbar/types";
import { useToolbarItem } from "./use-toolbar-item";

/** Public properties for one Toolbar toggle action. */
interface Props {
  /** Tooltip explanation; defaults to the accessible label. */
  readonly tooltip?: string | false;
  /** Keys shown beside the tooltip text in reading order; display only. */
  readonly shortcut?: readonly string[];
  /** Reason displayed while this control is unavailable. */
  readonly disabledReason?: string;
  /** Optional visible text beside the icon. */
  readonly text?: string;
  /** 开关的可访问名称，图标不会替代此名称。 */
  readonly label: string;
  /** Native button submission behavior. */
  readonly type?: ButtonHTMLAttributes["type"];
  /** Whether activation and keyboard focus are unavailable. */
  readonly disabled?: boolean;
  /** Optional description element for a disabled reason or tooltip detail. */
  readonly describedBy?: string;
}

/** Public events emitted by one Toolbar toggle. */
interface Emits {
  /** Emitted with the next binary state after enabled activation. */
  readonly activate: [pressed: boolean, event: MouseEvent];
}

/** Public slots for one Toolbar toggle. */
interface Slots {
  /** 图标内容，通常使用 QuireIcon。 */
  readonly default?: () => unknown;
}

const {
  label,
  text,
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
const pressed = defineModel<QuireKitToolbarToggleState>({ default: false });
const item = useToolbarItem(() => disabled);

/** @param event - Native activation that flips false or mixed to on, and on to off. */
function activate(event: MouseEvent): void {
  if (disabled) {
    event.preventDefault();
    return;
  }
  const next = pressed.value !== true;
  pressed.value = next;
  emit("activate", next, event);
}
</script>

<template>
  <ToolbarTooltip :trigger-id="typeof $attrs.id === 'string' ? $attrs.id : item.id" :label="label" :tooltip="tooltip" :shortcut="shortcut" :disabled-reason="disabledReason" :subject-disabled="disabled" >
  <button
    :id="item.id"
    v-bind="$attrs"
    :title="undefined"
    :ref="(element) => { item.element.value = element as HTMLButtonElement | null }"
    :type="type"
    :class="['qk-toolbar__item', text === undefined && 'qk-toolbar__icon-button']"
    :aria-label="label"
    :aria-describedby="describedBy"
    :aria-pressed="pressed"
    :aria-disabled="disabled ? 'true' : undefined"
    :tabindex="item.tabIndex.value"
    :data-qk-toolbar-item="item.id"
    :data-state="pressed === false ? 'off' : 'on'"
    :data-mixed="pressed === 'mixed' ? '' : undefined"
    data-kind="toggle"
    @focus="item.handleFocus"
    @click="activate"
  >
    <span v-if="$slots.default" class="qk-toolbar__icon" aria-hidden="true"><slot /></span>
    <span v-if="text !== undefined" class="qk-toolbar__label">{{ text }}</span>
  </button>
  </ToolbarTooltip>
</template>
