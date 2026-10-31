import { quireIconRegistry, type QuireKitTheme } from "@quirekit/ui";
import { QuireIconProvider, QuireLocaleProvider, QuireThemeProvider } from "@quirekit/ui/vue";
import { createApp, h, shallowReactive } from "vue";
import AiChatWorkspace from "../vue/workspace.vue";
import type { AiChatLocale, AiChatWorkspaceMount, AiChatWorkspaceMountOptions } from "./types";

/** Reactive host facts read by the mounted workspace. */
interface AiChatMountState {
  /** Immutable theme snapshot. */
  theme: QuireKitTheme;
  /** Current product language. */
  locale: AiChatLocale;
}

/**
 * Mounts the AI workspace into a host-agnostic element.
 *
 * @param options - Owner document, conversation and initial host facts.
 * @returns Retained lifecycle the host places, updates and destroys.
 */
export function mountAiChatWorkspace(options: AiChatWorkspaceMountOptions): AiChatWorkspaceMount {
  let onClose = options.onClose;
  const state = shallowReactive<AiChatMountState>({ theme: options.theme, locale: options.locale });
  const element = options.ownerDocument.createElement("div");
  element.className = "qk-ai-chat-mount";
  // The workspace owns its own Vue app because the host may bundle a separate
  // runtime; only immutable theme values cross the boundary.
  const app = createApp({
    render: () => h(QuireThemeProvider, { theme: state.theme }, {
      default: () => h(QuireLocaleProvider, { locale: state.locale }, {
        default: () => h(QuireIconProvider, { registry: quireIconRegistry }, {
          default: () => h(AiChatWorkspace, {
            controller: options.controller,
            locale: state.locale,
            onClose: () => onClose()
          })
        })
      })
    })
  });
  app.config.idPrefix = `qk-ai-chat-${Array.from(
    globalThis.crypto.getRandomValues(new Uint32Array(2)), value => value.toString(36)
  ).join("-")}`;
  app.mount(element);

  return {
    element,
    update(next) {
      onClose = next.onClose;
      if (state.theme !== next.theme) state.theme = next.theme;
      state.locale = next.locale;
    },
    destroy() {
      app.unmount();
      element.remove();
    }
  };
}
