<script setup lang="ts">
import { useQuireOverlayHost } from "../overlay-provider";
import QuireThemePortal from "../theme-provider/portal.vue";
import { computed, onMounted, ref, useAttrs } from "vue";
import { Tooltip, useTooltipContext } from "@ark-ui/vue/tooltip";
import { resolveTooltipContent } from "../../components/tooltip";
import { useModalPortal } from "../shared/surface/use-modal-portal";
import { chordText, keyLabel } from "../kbd/labels";

/** Tooltip Content 的公开属性。 */
interface Props {
  /** 普通提示标签或快捷键说明。 */
  readonly content?: string;
  /** 显示在提示文字后的快捷键，按阅读顺序列出；仅展示，不注册按键。 */
  readonly shortcut?: readonly string[];
  /** 控件不可用时替换普通提示的原因说明。 */
  readonly disabledReason?: string;
  /** 被提示的控件是否不可用。 */
  readonly subjectDisabled?: boolean;
  /** 是否把浮层内容传送到 portal 目标。 */
  readonly portalled?: boolean;
  /** Portal 的目标元素或 CSS 选择器。 */
  readonly portalTarget?: string | HTMLElement;
  /** 是否渲染与当前 placement 同步的定位箭头；默认开启。 */
  readonly showArrow?: boolean;
}

/** Tooltip Content 的组合插槽。 */
interface Slots {
  /** 可覆盖纯文本提示；slot prop 始终返回已解析的当前文案。 */
  readonly default?: (props: {
    readonly content: string | undefined;
  }) => unknown;
}

const props = withDefaults(defineProps<Props>(), {
  subjectDisabled: false,
  portalled: true,
  showArrow: true
});
defineSlots<Slots>();
defineOptions({ inheritAttrs: false });

const portal = useQuireOverlayHost(() => props.portalTarget);
const attrs = useAttrs();
const context = useTooltipContext();
const { disabled: portalDisabled } = useModalPortal(() => props.portalled, () => context.value.open);
// Independent async boundaries may hydrate in a different order from server portals.
// Keep this content beside its trigger until its own boundary has been hydrated.
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
const resolvedContent = computed(() =>
  resolveTooltipContent({
    subjectDisabled: props.subjectDisabled,
    ...(props.content === undefined ? {} : { content: props.content }),
    ...(props.disabledReason === undefined
      ? {}
      : { disabledReason: props.disabledReason })
  })
);
const shortcutText = computed(() =>
  props.shortcut?.length && !(props.subjectDisabled && props.disabledReason) ? chordText(props.shortcut) : "");
</script>

<template>
  <Teleport
    :to="portal.target.value"
    :disabled="portalDisabled || !mounted"
  >
    <QuireThemePortal>
      <Tooltip.Positioner
        v-if="$slots.default || resolvedContent"
        class="qk-tooltip__positioner"
        style="pointer-events: none"
        data-scope="tooltip"
        data-part="positioner"
      >
        <Tooltip.Content
          v-bind="attrs"
          class="qk-tooltip__content"
          data-scope="tooltip"
          data-part="content"
        >
          <Tooltip.Arrow
            v-if="showArrow"
            class="qk-tooltip__arrow"
            data-scope="tooltip"
            data-part="arrow"
          >
            <Tooltip.ArrowTip
              class="qk-tooltip__arrow-tip"
              data-scope="tooltip"
              data-part="arrow-tip"
            />
          </Tooltip.Arrow>
          <slot :content="resolvedContent">
            {{ resolvedContent }}<kbd v-if="shortcutText" class="qk-tooltip__shortcut" :aria-label="keyLabel(shortcut!)">{{ shortcutText }}</kbd>
          </slot>
        </Tooltip.Content>
      </Tooltip.Positioner>
    </QuireThemePortal>
  </Teleport>
</template>
