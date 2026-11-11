<script lang="ts">
import { useQuireOverlayHost } from "../overlay-provider";
import { usePresenceContext } from "@ark-ui/vue/presence";
import { defineComponent, h, inject, onMounted } from "vue";
import { trackQuireKitInputModality } from "../../components/control/modality";
import {
  quireKitThemeKey,
  useQuireInheritedThemePortals
} from "./context";
import QuireThemeSurface from "./surface.vue";

// The SFC compiler drops an annotation on `export default`, so the pure call is on its own declaration.
const ThemePortal = /* @__PURE__ */ defineComponent({
  name: "QuireThemePortal",
  inheritAttrs: false,
  /**
   * Restores DOM inheritance only while the owning floating surface is mounted.
   * @param _props - Portal targets and presentation belong to the owning component.
   * @param context - Original floating children, including backdrop and arrows.
   * @returns Render function following Ark's existing presence lifecycle.
   */
  setup(_props, context) {
    const host = useQuireOverlayHost();
    const theme = inject(quireKitThemeKey, undefined);
    const presence = usePresenceContext();
    const inherited = useQuireInheritedThemePortals();
    // Floating surfaces return focus to their trigger; modality keeps pointer-driven returns ring-free.
    onMounted(() => trackQuireKitInputModality(document));
    // An empty body sibling would be hidden by an already-open parent modal
    // before this child opens. Follow unmounted, not open/present: exit animation
    // and explicitly retained content must keep their original DOM lifetime.
    return () => !theme || inherited || host.target.value !== "body" || presence?.value.unmounted
      ? context.slots.default?.()
      : h(QuireThemeSurface, { layout: "bridge" }, context.slots);
  },
});

export default ThemePortal;
</script>
