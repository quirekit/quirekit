<script setup lang="ts">
import QuireIconButton from "../button/icon-button.vue";
import QuireIcon from "../icon/icon.vue";
import QuireTooltipContent from "../tooltip/content.vue";
import QuireTooltipRoot from "../tooltip/root.vue";
import QuireTooltipTrigger from "../tooltip/trigger.vue";

/** One icon command on a comment card, explained by a tooltip. */
interface Props {
  /** Accessible name and tooltip text. */
  readonly label: string;
  /** Registered icon name. */
  readonly icon: string;
  /** Button color; defaults to the icon button's own. */
  readonly color?: "neutral" | "success" | undefined;
  /** Button emphasis; defaults to the icon button's own. */
  readonly variant?: "ghost" | "soft" | undefined;
  /** Whether the command is unavailable. */
  readonly disabled?: boolean | undefined;
}

defineOptions({ inheritAttrs: false });
defineProps<Props>();
</script>

<template>
  <QuireTooltipRoot placement="top">
    <QuireTooltipTrigger as-child>
      <QuireIconButton v-bind="{ ...$attrs, ...(color ? { color } : {}), ...(variant ? { variant } : {}) }" size="xs" :label="label" :disabled="disabled"><QuireIcon :name="icon" /></QuireIconButton>
    </QuireTooltipTrigger>
    <QuireTooltipContent :content="label" />
  </QuireTooltipRoot>
</template>
