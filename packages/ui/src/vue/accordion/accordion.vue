<script setup lang="ts">
import { Accordion } from "@ark-ui/vue/accordion";
import { computed } from "vue";
import type {
  QuireKitAccordionItem,
  QuireKitAccordionOrientation,
  QuireKitAccordionSize,
  QuireKitAccordionVariant
} from "../../components/accordion";
import QuireIcon from "../icon/icon.vue";

/** Vue Accordion 的公开属性。 */
interface Props {
  /** Accordion 根区域的可访问名称。 */
  readonly label: string;
  /** 按 DOM 顺序渲染的稳定条目。 */
  readonly items: readonly QuireKitAccordionItem[];
  /** 未受控使用时初始展开的条目值。 */
  readonly defaultValue?: string[];
  /** 是否允许同时展开多个条目。 */
  readonly multiple?: boolean;
  /** 是否允许关闭最后一个已展开条目。 */
  readonly collapsible?: boolean;
  /** 条目布局与方向键导航方向。 */
  readonly orientation?: QuireKitAccordionOrientation;
  /** 触发器高度与排版尺寸。 */
  readonly size?: QuireKitAccordionSize;
  /** outline 保留外框与分隔线；plain 通过间距组织条目。 */
  readonly variant?: QuireKitAccordionVariant;
  /** 是否禁止整个 Accordion 的交互。 */
  readonly disabled?: boolean;
  /** 是否延迟挂载尚未展开过的内容。 */
  readonly lazyMount?: boolean;
  /** 条目收起后是否卸载其内容。 */
  readonly unmountOnExit?: boolean;
}

/** Accordion 插槽接收的稳定条目上下文。 */
interface ItemSlotProps {
  /** 当前条目合同。 */
  readonly item: QuireKitAccordionItem;
  /** 当前条目是否已经展开。 */
  readonly expanded: boolean;
}

/** Accordion 的可替换内容位置。 */
interface Slots {
  /** 替换每个触发器的可见内容。 */
  readonly trigger?: (props: ItemSlotProps) => unknown;
  /** 替换每个条目的状态指示图形。 */
  readonly indicator?: (props: ItemSlotProps) => unknown;
  /** 替换每个条目的展开内容。 */
  readonly content?: (props: ItemSlotProps) => unknown;
}

/** Accordion 发出的公开语义事件。 */
interface Emits {
  /** 用户交互产生新的展开值集合后触发。 */
  valueChange: [value: string[]];
}

const props = withDefaults(defineProps<Props>(), {
  defaultValue: () => [],
  multiple: false,
  collapsible: false,
  orientation: "vertical",
  size: "sm",
  variant: "outline",
  disabled: false,
  lazyMount: false,
  unmountOnExit: false
});
const expandedValues = defineModel<string[] | undefined>("value");
const emit = defineEmits<Emits>();
defineSlots<Slots>();

const currentValues = computed(() => expandedValues.value ?? props.defaultValue);
const optionalRootProps = computed(() => ({
  ...(expandedValues.value === undefined
    ? { defaultValue: props.defaultValue }
    : { modelValue: expandedValues.value })
}));

/**
 * 把 Ark machine 的下一值同步给可选的 v-model 与语义事件。
 *
 * @param value - 用户交互后处于展开状态的条目值。
 */
function updateValue(value: string[]): void {
  expandedValues.value = value;
  emit("valueChange", value);
}
</script>

<template>
  <Accordion.Root
    v-bind="optionalRootProps"
    :aria-label="label"
    :multiple="multiple"
    :collapsible="collapsible"
    :orientation="orientation"
    :disabled="disabled"
    :lazy-mount="lazyMount"
    :unmount-on-exit="unmountOnExit"
    :class="['qk-accordion', `qk-accordion--${orientation}`, { 'qk-accordion--plain': variant === 'plain' }]"
    @update:model-value="updateValue"
  >
    <Accordion.Item
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      :disabled="item.disabled"
      :class="['qk-accordion__item', { 'qk-accordion__item--plain': variant === 'plain' }]"
    >
      <Accordion.ItemTrigger
        :class="['qk-accordion__trigger', `qk-accordion__trigger--${size}`]"
      >
        <span class="qk-accordion__heading">
          <slot
            name="trigger"
            :item="item"
            :expanded="currentValues.includes(item.value)"
          >
            <span class="qk-accordion__title">{{ item.title }}</span>
            <span
              v-if="item.description !== undefined"
              class="qk-accordion__description"
            >
              {{ item.description }}
            </span>
          </slot>
        </span>
        <Accordion.ItemIndicator class="qk-accordion__indicator">
          <slot
            name="indicator"
            :item="item"
            :expanded="currentValues.includes(item.value)"
          >
            <QuireIcon name="chevronRight" :size="16" />
          </slot>
        </Accordion.ItemIndicator>
      </Accordion.ItemTrigger>

      <Accordion.ItemContent class="qk-accordion__content">
        <div class="qk-accordion__content-inner">
          <slot
            name="content"
            :item="item"
            :expanded="currentValues.includes(item.value)"
          >
            {{ item.content }}
          </slot>
        </div>
      </Accordion.ItemContent>
    </Accordion.Item>
  </Accordion.Root>
</template>
