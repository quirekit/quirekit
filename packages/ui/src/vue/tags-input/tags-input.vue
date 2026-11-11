<script setup lang="ts">
import { TagsInput } from "@ark-ui/vue/tags-input";
import type {
  TagsInputInputValueChangeDetails,
  TagsInputValidityChangeDetails,
  TagsInputValueChangeDetails
} from "@ark-ui/vue/tags-input";
import { computed, ref, useId } from "vue";
import type {
  QuireKitTagsInputInvalidDetails,
  QuireKitTagsInputItemSlotProps,
  QuireKitTagsInputTextChangeDetails,
  QuireKitTagsInputValidateDetails,
  QuireKitTagsInputValueChangeDetails
} from "../../components/tags-input";
import type { QuireKitControlSize } from "../../components/control";
import QuireIcon from "../icon/icon.vue";
import { useQuireKitMessages } from "../locale-provider/context";
import { guardTagsPasteLimit } from "./paste";

/** Vue TagsInput 的公开属性。 */
interface Props {
  /** 输入行的共享控件尺寸；多行标签自然增高。 */
  readonly size?: QuireKitControlSize;
  /** 始终可见且可访问的字段名称。 */
  readonly label: string;
  /** 字段下方的补充说明。 */
  readonly description?: string;
  /** 外部 invalid 状态的恢复说明；省略时使用语言包的通用提示。 */
  readonly errorText?: string;
  /** 空集合时的输入提示；省略时使用语言包的通用提示。 */
  readonly placeholder?: string;
  /** 未受控模式的初始标签集合。 */
  readonly defaultValue?: string[];
  /** 标签数量上限；超量粘贴会保留待修改文本。 */
  readonly max?: number;
  /** 单个输入值的最大字符数。 */
  readonly maxLength?: number;
  /** 提交和粘贴拆分标签时使用的分隔符。 */
  readonly delimiter?: string | RegExp;
  /** 粘贴包含分隔符的文本时是否批量新增标签。 */
  readonly addOnPaste?: boolean;
  /** 是否允许重复标签。 */
  readonly allowDuplicates?: boolean;
  /** 达到 max 后是否仍允许新增并进入 invalid 状态。 */
  readonly allowOverflow?: boolean;
  /** 标签是否可通过 Enter 或双击就地编辑。 */
  readonly editable?: boolean;
  /** 输入失焦时清空还是提交尚未完成的文本。 */
  readonly blurBehavior?: "clear" | "add";
  /** 是否显示一键清空操作。 */
  readonly clearable?: boolean;
  /** 原生表单字段名。 */
  readonly name?: string;
  /** 关联的 form id。 */
  readonly form?: string;
  /** 控件接受的 CSS 宽度。 */
  readonly width?: string | number;
  /** 是否禁用输入、编辑和移除。 */
  readonly disabled?: boolean;
  /** 是否保留聚焦和读取但禁止修改。 */
  readonly readOnly?: boolean;
  /** 是否要求表单提交至少一个标签。 */
  readonly required?: boolean;
  /** 是否由宿主标记为校验错误。 */
  readonly invalid?: boolean;
  /** 新增前规范化标签文本。 */
  readonly sanitizeValue?: ((value: string) => string) | undefined;
  /** 宿主追加的标签校验。 */
  readonly validate?: ((details: QuireKitTagsInputValidateDetails) => boolean) | undefined;
}

/** TagsInput 的可替换内容位置。 */
interface Slots {
  /** 替换一个标签的预览内容。 */
  readonly item?: (props: QuireKitTagsInputItemSlotProps) => unknown;
  /** 标签右侧的数量或局部状态。 */
  readonly meta?: (props: { readonly count: number; readonly atMax: boolean }) => unknown;
  /** 替换当前说明或错误文本。 */
  readonly message?: (props: { readonly invalid: boolean }) => unknown;
}

/** TagsInput 发出的公开语义事件。 */
interface Emits {
  /** 标签集合发生变化。 */
  valueChange: [details: QuireKitTagsInputValueChangeDetails];
  /** 尚未提交的输入文本发生变化。 */
  inputValueChange: [details: QuireKitTagsInputTextChangeDetails];
  /** 达到数量上限或候选标签未通过校验。 */
  valueInvalid: [details: QuireKitTagsInputInvalidDetails];
}

const props = withDefaults(defineProps<Props>(), {
  size: "sm",
  defaultValue: () => [],
  max: Infinity,
  delimiter: ",",
  addOnPaste: true,
  allowDuplicates: false,
  allowOverflow: false,
  editable: true,
  blurBehavior: "clear",
  clearable: true,
  width: "100%",
  disabled: false,
  readOnly: false,
  required: false,
  invalid: false,
  sanitizeValue: (value: string) => value.trim(),
  validate: undefined
});
const modelValue = defineModel<string[] | undefined>();
const emit = defineEmits<Emits>();
defineSlots<Slots>();

const text = useQuireKitMessages("tagsInput");
const generatedId = useId();
const messageId = computed(() => `qk-tags-input-${generatedId}-message`);
const rootStyle = computed(() => ({ width: props.width }));
const localError = ref<string>();
const effectiveInvalid = computed(() => props.invalid || localError.value !== undefined);
const visibleMessage = computed(() => {
  if (props.invalid) return props.errorText ?? text.value.invalid;
  return localError.value ?? props.description;
});
const translations = computed(() => ({
  clearTriggerLabel: text.value.clearAll,
  deleteTagTriggerLabel: text.value.remove,
  tagSelected: text.value.selected,
  tagAdded: text.value.added,
  tagsPasted: (values: string[]) => text.value.pasted(values.length),
  tagEdited: text.value.editing,
  tagUpdated: text.value.updated,
  tagDeleted: text.value.removed,
  noTagsSelected: text.value.noneSelected,
  inputLabel: (count: number) => text.value.inputLabel(props.label, count)
}));
const optionalRootProps = computed(() => ({
  ...(modelValue.value === undefined
    ? { defaultValue: props.defaultValue }
    : { modelValue: modelValue.value }),
  ...(props.maxLength === undefined ? {} : { maxLength: props.maxLength }),
  ...(props.name === undefined ? {} : { name: props.name }),
  ...(props.form === undefined ? {} : { form: props.form }),
  ...(props.validate === undefined ? {} : { validate: props.validate }),
  ...(props.sanitizeValue === undefined ? {} : { sanitizeValue: props.sanitizeValue })
}));

/**
 * 同步受控集合并转发完整标签变化详情。
 *
 * @param details - Ark 标签集合变化详情。
 */
function handleValueChange(details: TagsInputValueChangeDetails): void {
  modelValue.value = details.value;
  localError.value = undefined;
  emit("valueChange", details);
}

/**
 * 转发尚未提交的输入文本。
 *
 * @param details - Ark 输入文本变化详情。
 */
function handleInputValueChange(details: TagsInputInputValueChangeDetails): void {
  if (details.inputValue.length > 0) localError.value = undefined;
  emit("inputValueChange", details);
}

/**
 * 把 Ark 校验原因转为可见恢复说明并转发事件。
 *
 * @param details - Ark 候选值校验详情。
 */
function handleValueInvalid(details: TagsInputValidityChangeDetails): void {
  localError.value = details.reason === "rangeOverflow"
    ? text.value.overflow(props.max)
    : text.value.rejected;
  emit("valueInvalid", details);
}
</script>

<template>
  <TagsInput.Root
    v-bind="optionalRootProps"
    :max="max"
    :delimiter="delimiter"
    :add-on-paste="addOnPaste"
    :allow-duplicates="allowDuplicates"
    :allow-overflow="allowOverflow"
    :editable="editable"
    :blur-behavior="blurBehavior"
    :disabled="disabled"
    :read-only="readOnly"
    :required="required"
    :invalid="effectiveInvalid"
    :style="rootStyle"
    :class="[
      'qk-tags-input',
      effectiveInvalid && 'qk-tags-input--invalid',
      disabled && 'qk-tags-input--disabled',
      readOnly && 'qk-tags-input--readonly'
    ]"
    :translations="translations"
    @update:model-value="modelValue = $event"
    @value-change="handleValueChange"
    @input-value-change="handleInputValueChange"
    @value-invalid="handleValueInvalid"
  >
    <TagsInput.Context v-slot="tagsInput">
      <span class="qk-tags-input__header">
        <TagsInput.Label class="qk-tags-input__label">
          {{ label }}<span v-if="required" class="qk-tags-input__required" aria-hidden="true">*</span>
        </TagsInput.Label>
        <span class="qk-tags-input__meta">
          <slot name="meta" :count="tagsInput.count" :at-max="tagsInput.atMax">
            {{ tagsInput.count }}<template v-if="Number.isFinite(max)"> / {{ max }}</template>
          </slot>
        </span>
      </span>

      <TagsInput.Control :class="['qk-tags-input__control', `qk-tags-input__control--${size}`]">
        <TagsInput.Item
          v-for="(value, index) in tagsInput.value"
          :key="`${value}-${index}`"
          :index="index"
          :value="value"
          class="qk-tags-input__item"
        >
          <TagsInput.ItemContext v-slot="item">
            <TagsInput.ItemPreview class="qk-tags-input__item-preview">
              <slot
                name="item"
                :value="value"
                :index="index"
                :editing="item.editing"
                :highlighted="item.highlighted"
                :remove="() => { if (!disabled && !readOnly) tagsInput.setValue(tagsInput.value.filter((_, itemIndex) => itemIndex !== index)); }"
              >
                <TagsInput.ItemText class="qk-tags-input__item-text">{{ value }}</TagsInput.ItemText>
                <TagsInput.ItemDeleteTrigger v-if="!readOnly" class="qk-tags-input__delete">
                  <QuireIcon name="close" :size="12" />
                </TagsInput.ItemDeleteTrigger>
              </slot>
            </TagsInput.ItemPreview>
            <TagsInput.ItemInput class="qk-tags-input__item-input" />
          </TagsInput.ItemContext>
        </TagsInput.Item>

        <TagsInput.Input
          class="qk-tags-input__input"
          :placeholder="tagsInput.atMax ? text.atMax : placeholder ?? text.placeholder"
          :aria-describedby="visibleMessage === undefined ? undefined : messageId"
          @input.capture="guardTagsPasteLimit($event, tagsInput, props, handleValueInvalid)"
        />

        <TagsInput.ClearTrigger
          v-if="clearable && tagsInput.count > 0 && !readOnly"
          class="qk-tags-input__clear"
        >
          <QuireIcon name="close" :size="16" />
        </TagsInput.ClearTrigger>
      </TagsInput.Control>
      <TagsInput.HiddenInput />

      <p
        v-if="visibleMessage !== undefined"
        :id="messageId"
        :class="['qk-tags-input__message', effectiveInvalid && 'qk-tags-input__message--error']"
        :role="effectiveInvalid ? 'alert' : undefined"
      >
        <slot name="message" :invalid="effectiveInvalid">{{ visibleMessage }}</slot>
      </p>
    </TagsInput.Context>
  </TagsInput.Root>
</template>
