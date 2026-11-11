<script lang="ts">
import { defineComponent, h, inject, onMounted } from "vue";
import { trackQuireKitInputModality } from "../../components/control/modality";
import { quireKitThemeKey } from "./context";
import { resolveThemeSurfaceStyle } from "./styles";

// The SFC compiler drops an annotation on `export default`, so the pure call is on its own declaration.
const ThemeSurface = /* @__PURE__ */ defineComponent({
  name: "QuireThemeSurface",
  inheritAttrs: false,
  props: {
    /** Floating portals use a real box; ordinary provider scopes remain layout-neutral. */
    layout: {
      type: String as () => "contents" | "bridge",
      default: "contents"
    }
  },
  /**
   * Separates theme patching from descendant slot updates.
   * @param _props - This internal scope accepts no presentation props.
   * @param context - Slots whose updates must remain independent of the theme.
   * @returns Render function preserving native style identity across slot updates.
   */
  setup(props, context) {
    const theme = inject(quireKitThemeKey, undefined);
    onMounted(() => trackQuireKitInputModality(document));
    // A compiled :style binding carries Vue's STYLE patch flag and writes every
    // property whenever changing slots rerender this scope. A native h() vnode
    // uses ordinary prop identity checks, while still patching all slot children.
    return () => theme ? h("div", {
      "data-qk-theme-surface": "",
      "data-qk-scheme": theme.value.scheme,
      style: resolveThemeSurfaceStyle(theme.value, props.layout),
    }, context.slots.default?.()) : context.slots.default?.();
  },
});

export default ThemeSurface;
</script>
