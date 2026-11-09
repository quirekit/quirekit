<script setup lang="ts">
import { SegmentGroup } from "@ark-ui/vue/segment-group";
import { computed } from "vue";
import { guardRadioReadOnlyKey } from "../radio-group/keyboard";
import type {
  QuireKitSegmentedItem,
  QuireKitSegmentedOrientation,
  QuireKitSegmentedShape,
  QuireKitSegmentedSize
} from "../../components/segmented";

/** Vue Segmented Control 的公开属性。 */
interface Props {
  /** 按 DOM 顺序渲染的稳定选项。 */
  readonly items: readonly QuireKitSegmentedItem[];
  /** radiogroup 的可访问名称。 */
  readonly label: string;
  /** 首次渲染时使用的非受控选中值。 */
  readonly defaultValue?: string;
  /** 原生 radio 输入共享的表单字段名。 */
  readonly name?: string;
  /** 原生 radio 输入关联的 form id。 */
  readonly form?: string;
  /** 同步约束高度、排版、间距和图标盒的公开尺寸。 */
  readonly size?: QuireKitSegmentedSize;
  /** rounded 使用主题控件圆角；pill 使轨道与选中片两端呈半圆；square 为直角。 */
  readonly shape?: QuireKitSegmentedShape;
  /** 选项排列和可访问方向；方向键遵循原生 radio 行为。 */
  readonly orientation?: QuireKitSegmentedOrientation;
  /** 是否让每个选项占据相同比例的可用空间。 */
  readonly equal?: boolean;
  /** 是否禁止整组选择。 */
  readonly disabled?: boolean;
  /** 是否保留聚焦和表单提交，同时阻止修改当前值。 */
  readonly readOnly?: boolean;
}

/** 自定义一个选项可见内容时获得的稳定上下文。 */
interface ItemSlotProps {
  /** 当前渲染的选项合同。 */
  readonly item: QuireKitSegmentedItem;
  /** 当前选项是否已选中。 */
  readonly selected: boolean;
}

/** Vue Segmented Control 的内容插槽。 */
interface Slots {
  /** 替换选项的可见内容，保留标签关联。 */
  readonly item?: (props: ItemSlotProps) => unknown;
}

const {
  items,
  label,
  defaultValue,
  name,
  form,
  size = "sm",
  shape = "rounded",
  orientation = "horizontal",
  equal = false,
  disabled = false,
  readOnly = false
} = defineProps<Props>();

const selectedValue = defineModel<string | null>();
const optionalRootProps = computed(() => ({
  ...(selectedValue.value === undefined
    ? {}
    : { modelValue: selectedValue.value }),
  ...(defaultValue === undefined ? {} : { defaultValue }),
  ...(name === undefined ? {} : { name }),
  ...(form === undefined ? {} : { form })
}));
defineSlots<Slots>();
</script>

<template>
  <SegmentGroup.Root
    v-bind="optionalRootProps"
    :orientation="orientation"
    :disabled="disabled"
    :read-only="readOnly"
    :aria-label="label"
    data-qk-scope="segmented"
    :class="[
      'qk-segmented',
      `qk-segmented--${size}`,
      `qk-segmented--${orientation}`,
      shape !== 'rounded' && `qk-segmented--${shape}`,
      equal && 'qk-segmented--equal'
    ]"
    @update:model-value="selectedValue = $event"
    @keydown.capture="guardRadioReadOnlyKey($event, readOnly)"
  >
    <SegmentGroup.Indicator class="qk-segmented__indicator" />
    <SegmentGroup.Item
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      :disabled="item.disabled"
      :class="['qk-segmented__item', `qk-segmented__item--${size}`]"
    >
      <SegmentGroup.ItemContext v-slot="itemState">
        <SegmentGroup.ItemHiddenInput :disabled="itemState.disabled" />
      </SegmentGroup.ItemContext>
      <SegmentGroup.ItemText class="qk-segmented__label" :aria-label="item.label">
        <slot
          name="item"
          :item="item"
          :selected="
            selectedValue === item.value ||
            (selectedValue === undefined && defaultValue === item.value)
          "
        >
          {{ item.label }}
        </slot>
      </SegmentGroup.ItemText>
    </SegmentGroup.Item>
  </SegmentGroup.Root>
</template>
