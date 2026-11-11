<script lang="ts">
import { defineComponent, h, type PropType } from "vue";
import { previewColors } from "./appearance";

const styles = Object.freeze({
  light: Object.freeze({ ...previewColors.light, display: "contents" }),
  dark: Object.freeze({ ...previewColors.dark, display: "contents" })
});

// The SFC compiler drops an annotation on `export default`, so the pure call is on its own declaration.
const ImagePreviewThemeSurface = /* @__PURE__ */ defineComponent({
  name: "QuireImagePreviewThemeSurface",
  inheritAttrs: false,
  props: {
    /** Preview-owned contrast palette; host geometry and typography still inherit. */
    scheme: { type: String as PropType<"light" | "dark">, required: true }
  },
  /**
   * Keeps the preview palette independent of Ark content attribute updates.
   * @param props - Explicit preview contrast scheme.
   * @param context - Original content without an additional layout box.
   * @returns Native renderer whose stable style identity avoids palette rewrites.
   */
  setup(props, context) {
    return () => h("div", { style: styles[props.scheme] }, context.slots.default?.());
  }
});

export default ImagePreviewThemeSurface;
</script>
