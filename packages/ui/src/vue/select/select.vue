<script setup lang="ts">
import { useQuireOverlayHost } from "../overlay-provider";
import QuireThemePortal from "../theme-provider/portal.vue";
import type { QuireKitListDensity } from "../../components/control";

import { Select, createListCollection } from "@ark-ui/vue/select";
import { computed, onMounted, ref, watch, type HTMLAttributes } from "vue";
import type {
  QuireKitSelectBorder,
  QuireKitSelectItem,
  QuireKitSelectLength,
  QuireKitSelectPlacement,
  QuireKitSelectSize
} from "../../components/select";
import QuireIcon from "../icon/icon.vue";
import { chordText, keyLabel } from "../kbd/labels";
import { useModalPortal } from "../shared/surface/use-modal-portal";
import { useQuireKitMessages } from "../locale-provider/context";

/** 单选表单控件的公开属性。 */
interface Props {
  /** 受控的单个语义值。 */
  readonly modelValue?: string;
  /** 非受控模式的初始值。 */
  readonly defaultValue?: string;
  /** 按稳定顺序渲染的可用选项。 */
  readonly items: readonly QuireKitSelectItem[];
  /** 尚未选择时显示的提示；省略时取自语言包。 */
  readonly placeholder?: string | undefined;
  /** 触发器与列表的可访问名称。 */
  readonly label: string;
  /** 控件高度和排版尺寸。 */
  readonly size?: QuireKitSelectSize;
  /** Trigger appearance; text is a borderless action suitable for toolbars. Defaults to outline. */
  readonly variant?: "outline" | "text";
  /** Independent list density; defaults to compact for xs/sm triggers and regular otherwise. */
  readonly contentDensity?: QuireKitListDensity;
  /** 触发器的 CSS 宽度。 */
  readonly width?: QuireKitSelectLength;
  /** 浮层的独立 CSS 宽度；省略时跟随触发器。 */
  readonly contentWidth?: QuireKitSelectLength;
  /** 附加到浮层内容的主题、语言和归属属性。 */
  readonly contentProps?: HTMLAttributes;
  /** 浮层的可选边界强度；默认不显示边框。 */
  readonly border?: QuireKitSelectBorder;
  /** 浮层的首选方位。 */
  readonly placement?: QuireKitSelectPlacement;
  /** 是否把浮层传送到 body。 */
  readonly portalled?: boolean;
  /** 浮层相对自身普通或模态所属层的偏移；嵌套列表可使用 1。 */
  readonly layerOffset?: number;
  /** 是否禁用整个控件。 */
  readonly disabled?: boolean;
  /** 是否以错误状态呈现。 */
  readonly invalid?: boolean;
  /** 是否要求原生表单提交一个值。 */
  readonly required?: boolean;
  /** 是否允许聚焦但禁止修改值。 */
  readonly readOnly?: boolean;
  /** 原生隐藏 select 的字段名。 */
  readonly name?: string;
  /** 原生隐藏 select 关联的 form id。 */
  readonly form?: string;
}

/** 单选表单控件的公开事件。 */
interface Emits {
  /** 同步受控的单个语义值。 */
  "update:modelValue": [value: string | undefined];
  /** 用户完成一次值选择。 */
  valueChange: [value: string | undefined];
}

/** 自定义选项内容时获得的稳定上下文。 */
interface ItemSlotProps {
  /** 当前渲染的选项。 */
  readonly item: QuireKitSelectItem;
}

/** Select 的可替换内容位置。 */
interface Slots {
  /** 替换选项的可见内容，保留可访问名称。 */
  readonly item?: (props: ItemSlotProps) => unknown;
}

const portal = useQuireOverlayHost();
const props = withDefaults(defineProps<Props>(), {
  size: "sm",
  variant: "outline",
  width: "160px",
  border: "none",
  placement: "bottom-start",
  portalled: true,
  layerOffset: 0,
  disabled: false,
  invalid: false,
  required: false,
  readOnly: false
});
const text = useQuireKitMessages("select");
const emit = defineEmits<Emits>();
defineSlots<Slots>();

const internalValue = ref(props.modelValue ?? props.defaultValue);
const open = defineModel<boolean | undefined>("open", { default: undefined });
const internalOpen = ref(false);
const selectOpen = computed({
  get: () => open.value ?? internalOpen.value,
  set: (value: boolean) => {
    internalOpen.value = value;
    open.value = value;
  }
});
const { hasModalOwner: ownedByModal, disabled: portalDisabled } = useModalPortal(() => props.portalled, () => selectOpen.value);
// Async SSR boundaries must claim their own inline content before moving it to body.
// Otherwise a faster sibling Select can consume this instance’s global portal anchor.
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
const collection = computed(() => createListCollection({
  items: [...props.items],
  itemToString: (item) => item.label,
  itemToValue: (item) => item.value,
  isItemDisabled: (item) => item.disabled === true
}));
const selectedValues = computed(() => {
  const value = props.modelValue ?? internalValue.value;
  return value === undefined ? [] : [value];
});
const optionalRootBindings = computed(() => ({
  ...(props.name === undefined ? {} : { name: props.name }),
  ...(props.form === undefined ? {} : { form: props.form })
}));
const triggerStyle = computed(() => ({ width: props.width }));
const contentStyle = computed(() => ({ width: props.contentWidth ?? props.width }));
// Portal DOM order can put the parent's layer after the child; preserve the modal owner's base.
const positionerStyle = computed(() => props.layerOffset === 0 ? undefined : ({
  "--qk-select-layer": `calc(var(${ownedByModal ? "--qk-layer-modal" : "--qk-layer-overlay"}) + ${props.layerOffset + (ownedByModal ? 1 : 0)})`
}));
const positioning = computed(() => ({
  ...(portal.strategy.value ? { strategy: portal.strategy.value } : {}),
  placement: props.placement,
  gutter: 4,
  sameWidth: props.contentWidth === undefined
}));

watch(() => props.modelValue, (value) => {
  if (value !== undefined) internalValue.value = value;
});

/**
 * 把 Ark 的单元素数组边界还原为公开的单值合同。
 *
 * @param values - Ark Select machine 返回的选择数组。
 */
function updateValue(values: string[]): void {
  const value = values[0];
  selectOpen.value = false;
  internalValue.value = value;
  emit("update:modelValue", value);
  emit("valueChange", value);
}
</script>

<template>
  <Select.Root :style="triggerStyle"
    v-bind="optionalRootBindings"
    :collection="collection"
    :model-value="selectedValues"
    :open="selectOpen"
    :disabled="disabled"
    :invalid="invalid"
    :required="required"
    :read-only="readOnly"
    :close-on-select="true"
    :lazy-mount="true"
    :unmount-on-exit="true"
    :positioning="positioning"
    @update:model-value="updateValue"
    @update:open="selectOpen = $event"
  >
    <Select.Control class="qk-select__control" style="width: 100%">
      <Select.Trigger
        :aria-label="label"
        :data-variant="variant"
        style="width: 100%"
        :class="['qk-select__trigger', `qk-select__trigger--${size}`]"
      >
        <Select.ValueText :placeholder="placeholder ?? text.placeholder" class="qk-select__value" />
        <Select.Indicator class="qk-select__indicator">
          <QuireIcon name="chevronDown" :size="16" />
        </Select.Indicator>
      </Select.Trigger>
    </Select.Control>

    <Teleport :to="portal.target.value" :disabled="portalDisabled || !mounted">
      <QuireThemePortal>
        <Select.Positioner :style="positionerStyle" :class="['qk-select__positioner', ownedByModal && 'qk-select__positioner--modal']">
          <Select.Content
            v-bind="contentProps"
            :aria-label="label"
            :style="[contentProps?.style, contentStyle]"
            :class="['qk-select__content', `qk-select__content--${contentDensity ?? (size === 'xs' || size === 'sm' ? 'compact' : 'regular')}`, `qk-select__content--border-${border}`]"
          >
            <Select.List class="qk-select__list">
              <Select.Item
                v-for="item in items"
                :key="item.value"
                :item="item"
                class="qk-select__item"
              >
                <Select.ItemText class="qk-select__item-label">
                  <slot name="item" :item="item">{{ item.label }}</slot>
                </Select.ItemText>
                <kbd v-if="item.shortcut?.length" class="qk-select__item-shortcut" :aria-label="keyLabel(item.shortcut)">{{ chordText(item.shortcut) }}</kbd>
                <Select.ItemIndicator class="qk-select__item-indicator">
                  <QuireIcon name="check" :size="16" />
                </Select.ItemIndicator>
              </Select.Item>
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </QuireThemePortal>
    </Teleport>
    <Select.HiddenSelect />
  </Select.Root>
</template>
