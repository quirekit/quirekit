import Input from "../../input/input.vue";
import Textarea from "../../textarea/textarea.vue";
import InputNumber from "../../input-number/input-number.vue";
import Select from "../../select/select.vue";
import BooleanControl from "./boolean.vue";
import type { QuireKitSchemaRegistry } from "../types";

/** Normalizes empty scalar values for controlled text/number/select components.
 * @param value - Stored scalar draft.
 * @returns A controlled string, including the empty value after reset.
 */
function textValue(value: unknown): string { return value == null ? "" : String(value); }

/** Built-in controls reuse existing QuireKit recipes and headless adapters. */
export const schemaControls: QuireKitSchemaRegistry = /* @__PURE__ */ Object.freeze({
  input: { component: Input, toControl: textValue },
  textarea: { component: Textarea, toControl: textValue },
  // NumberInput owns localized strings; numerical payload conversion belongs to the consumer.
  number: { component: InputNumber, toControl: textValue },
  select: { component: Select, toControl: textValue },
  checkbox: { component: BooleanControl, toControl: Boolean },
  switch: { component: BooleanControl, toControl: Boolean }
});
