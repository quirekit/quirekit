import type { QuireKitTheme } from "@quirekit/ui";
import type { AiChatController } from "../types";

/** Product language supported by the AI workspace. */
export type AiChatLocale = "zh-CN" | "en";

/** Host facts that may change while the workspace stays mounted. */
export interface AiChatWorkspaceMountState {
  /** Immutable theme snapshot applied to the workspace surface. */
  readonly theme: QuireKitTheme;
  /** Current product language. */
  readonly locale: AiChatLocale;
  /** Hides the host surface; the conversation outlives the mount. */
  readonly onClose: () => void;
}

/** Host inputs for mounting one AI workspace. */
export interface AiChatWorkspaceMountOptions extends AiChatWorkspaceMountState {
  /** Document that owns the created element. */
  readonly ownerDocument: Document;
  /** Host-owned conversation; mounting never owns its lifetime. */
  readonly controller: AiChatController;
}

/** Retained workspace lifecycle placed by the host. */
export interface AiChatWorkspaceMount {
  /** Element the host inserts into its own surface. */
  readonly element: HTMLElement;
  /**
   * Applies changed host facts without remounting.
   * @param state - Current theme, language and close handler.
   */
  update(state: AiChatWorkspaceMountState): void;
  /** Unmounts the workspace and removes its element. */
  destroy(): void;
}
