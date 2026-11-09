import type {
  QuireEditorInputBinding,
  QuireEditorInputBindingOptions,
  QuireEditorInputResetOptions
} from "./types";
import { bindQuireMountedInputProxyEventListeners } from "./binding/event-listeners";
import { QuireMountedInputEventRouter } from "./binding/event-router";
import { readQuireMountedInputEditable } from "./binding/editability";
import { hasQuireNativeCompositionEvidence } from "./binding/input-proxy-state";
import { NativeTextContextSession } from "./text-context/session";
import type { QuireTextContextLease, QuireTextContextProvider } from "./text-context/types";

/** Owns browser input listener lifecycle for one mounted view. */
export class QuireMountedInputBinding implements QuireEditorInputBinding {
  private readonly options: QuireEditorInputBindingOptions;
  private readonly eventRouter: QuireMountedInputEventRouter;
  private readonly removeListeners: Array<() => void> = [];
  private destroyed = false;
  private nativeInputNeedsRestart = false;
  private nativeComposing = false;
  private textContext: NativeTextContextSession | undefined;

  /**
   * Creates and binds a mounted view input lifecycle.
   *
   * @param options - Editor, input proxy, and render callbacks for the mounted view.
   */
  constructor(options: QuireEditorInputBindingOptions) {
    this.options = options;
    this.eventRouter = new QuireMountedInputEventRouter(options, this, () => this.textContext);
    this.removeListeners.push(bindQuireMountedInputProxyEventListeners(
      this.options.inputProxy,
      {
        beforeinput: this.eventRouter.handleBeforeInput.bind(this.eventRouter),
        keydown: this.eventRouter.handleKeyDown.bind(this.eventRouter),
        keyup: this.eventRouter.handleKeyUp.bind(this.eventRouter),
        input: this.eventRouter.handleInput.bind(this.eventRouter),
        compositionstart: this.eventRouter.handleCompositionStart.bind(this.eventRouter),
        compositionupdate: this.eventRouter.handleCompositionUpdate.bind(this.eventRouter),
        compositionend: this.eventRouter.handleCompositionEnd.bind(this.eventRouter),
        copy: this.eventRouter.handleCopy.bind(this.eventRouter),
        cut: this.eventRouter.handleCut.bind(this.eventRouter),
        paste: this.eventRouter.handlePaste.bind(this.eventRouter),
        focus: this.eventRouter.handleFocus.bind(this.eventRouter),
        blur: this.eventRouter.handleBlur.bind(this.eventRouter)
      },
      (event) => {
        // A JS cancel or compositionend cannot prove the OS session is clean.
        // Observe before routing because handlers may synchronously reset JS state.
        if (event.type === "blur") {
          this.nativeInputNeedsRestart = false;
        } else if (hasQuireNativeCompositionEvidence(event)) {
          this.nativeInputNeedsRestart = true;
        }
        if (event.type === "compositionstart" || (event as InputEvent).isComposing) this.nativeComposing = true;
        if (event.type === "compositionend" || event.type === "blur") this.nativeComposing = false;
      },
      (event, route) => {
        if (this.textContext) {
          this.textContext.route(event, route, (replacement) => {
            this.eventRouter.handleTextContextInput(replacement, event);
          });
        } else route();
      }
    ));
  }

  /**
   * Installs an exclusive context policy without replacing the native input owner.
   * @param provider - Bounded context compiler from a mounted service.
   * @returns Lease with composition-safe release.
   */
  attachTextContext(provider: QuireTextContextProvider): QuireTextContextLease {
    if (this.destroyed) throw new Error("Cannot attach text context to a destroyed input binding.");
    if (this.textContext?.retain(provider)) return this.textContext;
    if (this.textContext) throw new Error("The mounted input already has a text context owner.");
    if (!this.nativeComposing) this.eventRouter.cancelTransientInputState();
    this.textContext = new NativeTextContextSession({
      binding: this.options,
      provider,
      waitForComposition: this.nativeComposing,
      cancelInput: () => this.eventRouter.cancelTransientInputState(),
      onDispose: () => { this.textContext = undefined; }
    });
    return this.textContext;
  }

  /** Focuses the hidden input proxy without exposing it to application code. */
  focus(): void {
    if (this.destroyed) return;
    if (!readQuireMountedInputEditable(this.options)) {
      this.eventRouter.cancelTransientInputState();
    }

    // Read-only selections still need a native event target for semantic copy.
    // Editing stays guarded at event time and by the proxy's readOnly state.
    this.eventRouter.claimFocusOwnership();
    this.options.inputProxy.focus({ preventScroll: true });
  }

  /** Blurs the hidden input proxy and releases native editing ownership. */
  blur(): void {
    this.options.inputProxy.blur();
    this.eventRouter.releaseFocusOwnership();
  }

  /**
   * Clears transient IME/input state, optionally restarting the browser input host.
   *
   * @param options - Reset options for browser-owned input state.
   */
  resetTransientState(options: QuireEditorInputResetOptions = {}): void {
    const restartNativeInput = options.restartNativeInput === true
      || (options.restartNativeInput === "if-needed" && this.nativeInputNeedsRestart);
    this.eventRouter.cancelTransientInputState();

    if (restartNativeInput) {
      this.eventRouter.restartNativeInputSession();
    }
  }

  /** Removes browser event listeners owned by this binding. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.eventRouter.releaseFocusOwnership();
    this.textContext?.destroy();

    for (const removeListener of this.removeListeners.splice(0)) {
      removeListener();
    }
  }
}

/**
 * Creates a mounted input binding for an editable canvas view.
 *
 * @param options - Editor, input proxy, and render callbacks for the mounted view.
 * @returns Mounted input binding lifecycle object.
 */
export function createQuireEditorInputBinding(
  options: QuireEditorInputBindingOptions
): QuireEditorInputBinding {
  return new QuireMountedInputBinding(options);
}
