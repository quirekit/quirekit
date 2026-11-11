<script setup lang="ts">
import { ark } from "@ark-ui/vue/factory";
import { cloneVNode, Comment, computed, defineComponent, Fragment, isVNode, mergeProps, onMounted, onUpdated, ref } from "vue";
import type { ComponentPublicInstance, VNode } from "vue";

/** Stable physical button that delegates each original event to the active surface. */
interface Props {
  /** Shared public trigger identity supplied to both resident machines. */
  readonly id: string;
  /** Current effective availability. */
  readonly disabled?: boolean;
  /** Resolves fresh attributes and handlers from the selected machine. */
  readonly getBindings: () => object;
  /** Resolves the event's document and records its opener before machine dispatch. */
  readonly prepare: (event: Event) => boolean;
}

/** Native node identity consumed by presentation and final-focus ownership. */
interface Emits {
  /** Reports the mounted button without inserting another trigger. */
  element: [element: HTMLElement];
}

/** The task's single, persistent public trigger slot. */
interface Slots {
  /** A single real button; its component and DOM identity persist across presentation changes. */
  readonly default: () => VNode[];
}

defineOptions({ inheritAttrs: false });
const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const slots = defineSlots<Slots>();
const ArkButton = ark.button;
const button = ref<ComponentPublicInstance | HTMLElement>();
let emitted: HTMLElement | undefined;

/** Reports an actual mounted element rather than an Ark component proxy. */
function publishElement(): void {
  const value = button.value;
  const element = value && "$el" in value ? value.$el as HTMLElement : value;
  if (element?.nodeType === 1 && element !== emitted) {
    emitted = element;
    emit("element", element);
  }
}

/**
 * Lets the active machine consume the unchanged native event exactly once.
 * @param name - Handler key from Ark's normalized Vue bindings.
 * @param event - Actual native event, never queued or replayed.
 */
function dispatch(name: string, event: Event): void {
  if (event.defaultPrevented || props.disabled) return;
  const currentTarget = event.currentTarget;
  if (currentTarget && "disabled" in currentTarget && currentTarget.disabled) return;
  if ("isComposing" in event && (event.isComposing || (event as KeyboardEvent).keyCode === 229)) return;
  const prepares = event.type === "click" || event.type === "pointerdown"
    || (event.type === "keydown" && ["Enter", " ", "ArrowDown", "ArrowUp"].includes((event as KeyboardEvent).key));
  if (prepares && !props.prepare(event)) return;
  const handler = (props.getBindings() as Record<string, unknown>)[name];
  if (typeof handler === "function") handler(event);
}

const bindings = computed(() => {
  const current = props.getBindings();
  const result = Object.fromEntries(Object.entries(current).map(([key, value]) => [
    key, /^on[A-Z]/.test(key) && typeof value === "function"
      ? (event: Event) => dispatch(key, event)
      : value
  ]));
  // Drawer only supplies click. Keep the opening inputs resident so a same-frame
  // resize can select Menu's keyboard/pointer handlers before Vue renders again.
  for (const key of ["onClick", "onPointerdown", "onKeydown"]) result[key] = (event: Event) => dispatch(key, event);
  return result;
});

/**
 * Reaches the single button through Vue's slot-outlet fragments.
 * @param nodes - Current public slot output.
 * @returns The original button vnode, preserving its component and key.
 */
function findButton(nodes: readonly VNode[]): VNode | undefined {
  for (const node of nodes) {
    if (node.type === Comment) continue;
    if (node.type !== Fragment) return node;
    if (Array.isArray(node.children)) {
      const child = findButton(node.children.filter(isVNode));
      if (child) return child;
    }
  }
  return undefined;
}

// As-child normally lets child attributes win. This component has no DOM of its
// own; cloning keeps the original button while making task identity authoritative.
const SlotButton = /* @__PURE__ */ defineComponent({
  name: "TaskTriggerSlot",
  inheritAttrs: false,
  setup(_props, { attrs }) {
    return () => {
      const child = findButton(slots.default());
      if (!child) return null;
      return cloneVNode(child, {
        ...attrs, id: props.id, type: "button", disabled: props.disabled || child.props?.disabled
      }, true);
    };
  }
});
onMounted(publishElement);
onUpdated(publishElement);
</script>

<template>
  <component :is="ArkButton" ref="button" as-child v-bind="mergeProps($attrs, bindings)">
    <SlotButton />
  </component>
</template>
