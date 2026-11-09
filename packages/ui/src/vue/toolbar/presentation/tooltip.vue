<script setup lang="ts">
import { inject } from "vue";
import { toolbarMobileKey } from "../context";
import QuireTooltipRoot from "../../tooltip/root.vue";
import QuireTooltipTrigger from "../../tooltip/trigger.vue";
import QuireTooltipContent from "../../tooltip/content.vue";

/** Shared presentation for every Toolbar target; the Tooltip machine owns its lifecycle. */
interface Props {
  /** Preserve the owning control’s DOM identity across asChild composition. */
  readonly triggerId?: string | undefined;
  /** Accessible target name, also the default explanation. */
  readonly label: string;
  /** Override the label, or disable a tooltip owned by an enclosing compound control. */
  readonly tooltip?: string | false | undefined;
  /** Keys shown beside the explanation; hidden while a disabled reason replaces it. */
  readonly shortcut?: readonly string[] | undefined;
  /** Explanation displayed while the command is unavailable. */
  readonly disabledReason?: string | undefined;
  /** Current command availability, independent of tooltip availability. */
  readonly subjectDisabled?: boolean;
  /** Suppress the explanation while the target's interactive popup is open. */
  readonly suppressed?: boolean;
}
withDefaults(defineProps<Props>(), { tooltip: undefined });
const mobile = inject(toolbarMobileKey);
defineSlots<{
  /** Single native control; no extra layout wrapper or keyboard stop is created. */
  default: () => unknown;
  /** Optional full public TooltipContent for advanced compound consumers. */
  content?: () => unknown;
}>();
</script>

<template>
  <QuireTooltipRoot :trigger-id="triggerId" :disabled="mobile || suppressed || tooltip === false" placement="bottom">
    <QuireTooltipTrigger as-child><slot /></QuireTooltipTrigger>
    <slot name="content">
      <QuireTooltipContent v-bind="{ ...(tooltip === false ? {} : { content: tooltip ?? label }),
        ...(disabledReason === undefined ? {} : { disabledReason }), ...(shortcut?.length ? { shortcut } : {}) }" :subject-disabled="subjectDisabled ?? false" />
    </slot>
  </QuireTooltipRoot>
</template>
