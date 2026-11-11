import { defineComponent, h } from "vue";
import type { PropType, Slots, VNode, VNodeChild } from "vue";
import Fieldset from "../fieldset/fieldset.vue";
import FormField from "../form-field/form-field.vue";
import { useQuireForm } from "../form/context";
import { renderSchemaControl } from "./render-control";
import { validateSchemaTree } from "./validate-tree";
import type { QuireKitFormFieldSlotProps } from "../form-field/types";
import type { QuireKitSchemaCondition, QuireKitSchemaNode, QuireKitSchemaRegistry } from "./types";

/** Internal recursive renderer: identity, conditions and semantic grouping only. */
export default /* @__PURE__ */ defineComponent({
  name: "QuireSchemaFields",
  props: {
    nodes: { type: Array as PropType<readonly QuireKitSchemaNode[]>, required: true },
    registry: { type: Object as PropType<QuireKitSchemaRegistry>, default: () => ({}) },
    fieldSlots: { type: Object as PropType<Slots>, required: true }
  },
  /** Binds every rendered field to the enclosing form authority.
   * @param props - Tree, registry and forwarded field slots.
   * @returns Reactive recursive render function.
   */
  setup(props) {
    const form = useQuireForm();
    /** Resolves a trusted boolean/function condition.
     * @param condition - Optional node condition.
     * @param fallback - Default when absent.
     * @returns Resolved condition.
     */
    function condition(condition: QuireKitSchemaCondition | undefined, fallback: boolean): boolean {
      return typeof condition === "function" ? condition(form.values) : condition ?? fallback;
    }
    /** Renders siblings with stable keys; hidden nodes unmount their registrations.
     * @param nodes - Current siblings.
     * @param inheritedDisabled - Disabled ancestor group.
     * @param inheritedReadOnly - Readonly ancestor group.
     * @returns Visible field/group nodes.
     */
    function renderNodes(nodes: readonly QuireKitSchemaNode[], inheritedDisabled = false, inheritedReadOnly = false): VNode[] {
      return nodes.flatMap(node => {
        if (!condition(node.visible, true)) return [];
        const disabled = inheritedDisabled || condition(node.disabled, false);
        const readOnly = inheritedReadOnly || condition(node.readOnly, false);
        if ("children" in node) {
          return [h(Fieldset, {
            key: node.key, legend: node.legend, disabled, width: "100%",
            ...(node.legendHidden === undefined ? {} : { legendHidden: node.legendHidden }),
            ...(node.description === undefined ? {} : { description: node.description }),
            ...(node.appearance === undefined ? {} : { appearance: node.appearance }),
            ...(node.orientation === undefined ? {} : { orientation: node.orientation })
          }, () => renderNodes(node.children, disabled, readOnly))];
        }
        const { control: _control, props: _props, visible: _visible, ...fieldProps } = node;
        return [h(FormField, { ...fieldProps, key: node.key ?? node.name, disabled, readOnly }, {
          default: (field: QuireKitFormFieldSlotProps): VNodeChild => {
            const slot = { ...field, field: node, form };
            return props.fieldSlots[`field:${node.name}`]?.(slot) ?? renderSchemaControl(slot, props.registry);
          }
        })];
      });
    }
    return () => {
      validateSchemaTree(props.nodes);
      return renderNodes(props.nodes);
    };
  }
});
