<script lang="ts">
import { defineComponent, h, normalizeStyle, type CSSProperties, type PropType, type StyleValue } from "vue";
import { codeBlockColors } from "./appearance";

/**
 * Compares normalized caller values, including CSS fallback arrays.
 * @param previous - Detached snapshot from the last style update.
 * @param next - Current normalized style value.
 * @returns Whether the effective value is unchanged.
 */
function sameValue(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true;
  if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) return false;
  return previous.every((value, index) => Object.is(value, next[index]));
}

// The SFC compiler drops an annotation on `export default`, so the pure call is on its own declaration.
const CodeBlockThemeSurface = /* @__PURE__ */ defineComponent({
  name: "QuireCodeBlockThemeSurface",
  inheritAttrs: false,
  props: {
    /** Auto inherits all host tokens; explicit schemes isolate only source colors. */
    scheme: { type: String as PropType<"auto" | "light" | "dark">, required: true }
  },
  /**
   * Keeps the original business root independent of equivalent style allocations.
   * @param props - Requested source palette or inherited host theme.
   * @param context - Business attributes and stateful slot descendants.
   * @returns Original native root, preserving scoped CSS and descendant identity.
   */
  setup(props, context) {
    let previousScheme: typeof props.scheme | undefined;
    let previousCaller: Record<string, unknown> = {};
    let retained: Readonly<CSSProperties> | undefined;
    return () => {
      // Vue accepts objects, arrays and CSS strings. Compare their normalized
      // values before merging the palette so fresh equivalent caller objects
      // cannot make a content update rewrite every source color.
      const caller = normalizeStyle([context.attrs.style as StyleValue]) as Record<string, unknown>;
      const entries = Object.entries(caller);
      if (previousScheme !== props.scheme || entries.length !== Object.keys(previousCaller).length
        || entries.some(([name, value]) => !Object.hasOwn(previousCaller, name) || !sameValue(previousCaller[name], value))) {
        previousScheme = props.scheme;
        previousCaller = {};
        for (const [name, value] of entries) previousCaller[name] = Array.isArray(value) ? [...value] : value;
        retained = Object.freeze({
          ...(props.scheme === "auto" ? {} : codeBlockColors[props.scheme]),
          ...previousCaller as CSSProperties
        });
      }
      // One native root owns attrs, events and Vue's parent scope identifiers.
      // Only palette/style changes invalidate it; all slot updates still render.
      return h("div", { ...context.attrs, style: retained }, context.slots.default?.());
    };
  }
});

export default CodeBlockThemeSurface;
</script>
