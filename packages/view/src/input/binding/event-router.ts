import type { QuireEditorInputBindingOptions } from "../types";
import { createQuireImeInputEngine, type QuireImeEventResult } from "@quirekit/ime";
import { createMountedInputController } from "./controller";
import { createQuireMountedInputFocus, type QuireMountedInputFocus } from "./focus-ownership";
import { QuireMountedInputResultApplier } from "./result-applier";
import { readQuireMountedInputEditable } from "./editability";
import type { NativeTextContextSession } from "../text-context/session";
import type { NativeTextReplacement } from "../text-context/types";

/** Routes browser events for one mounted input binding. */
export class QuireMountedInputEventRouter {
  private readonly options: QuireEditorInputBindingOptions;
  private readonly controller: ReturnType<typeof createMountedInputController>;
  private readonly imeEngine: ReturnType<typeof createQuireImeInputEngine>;
  private readonly resultApplier: QuireMountedInputResultApplier;
  private readonly focus: QuireMountedInputFocus;
  private restartingNativeInputSession = false;

  /**
   * Creates a mounted input event router.
   *
   * @param options - Editor, input proxy, and render callbacks for the mounted view.
   * @param ownerToken - Stable identity token for focus ownership.
   * @param readTextContext - Optional native-context policy owned by this binding.
   */
  constructor(
    options: QuireEditorInputBindingOptions,
    ownerToken: object,
    private readonly readTextContext: () => NativeTextContextSession | undefined = () => undefined
  ) {
    this.options = options;
    this.focus = createQuireMountedInputFocus({
      binding: options,
      token: ownerToken,
      cancelTransientInputState: () => this.cancelTransientInputState(),
      isRestartingNativeSession: () => this.restartingNativeInputSession
    });
    this.controller = createMountedInputController(options);
    this.imeEngine = createQuireImeInputEngine();
    this.resultApplier = new QuireMountedInputResultApplier({
      binding: options,
      restoreInputProxy: () => this.readTextContext()?.restore() ?? false,
      commitCompositionText: (text) =>
        this.controller.handleCompositionEnd({ data: text })
    });
  }

  /**
   * Routes browser beforeinput intents through IME handling or editor input.
   *
   * @param event - Browser beforeinput event.
   */
  handleBeforeInput(event: Event): void {
    const inputEvent = event as InputEvent;

    if (this.blockUnownedInput(event) || this.blockReadOnlyEditingInput()) {
      return;
    }

    if (
      this.applyImeResult(
        this.imeEngine.handleBeforeInput({
          inputType: inputEvent.inputType,
          data: inputEvent.data,
          isComposing: inputEvent.isComposing,
          inputValue: this.readInputValue()
        }),
        event
      )
    ) {
      return;
    }

    const inputResult = this.controller.handleBeforeInput({
      inputType: inputEvent.inputType,
      data: inputEvent.data,
      isComposing: inputEvent.isComposing,
      preventDefault: preventDefaultOf(event)
    });

    if (this.resultApplier.applyInputResult("beforeinput", inputResult)) {
      this.resultApplier.rememberInputEcho(inputEvent.data);
    }
  }

  /**
   * Routes keyboard events through IME handling or editor keymaps.
   *
   * @param event - Browser keyboard event.
   */
  handleKeyDown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (this.blockReadOnlyEditingInput()) {
      // Read-only textareas can turn Backspace into browser history navigation.
      if (keyboardEvent.key === "Backspace") event.preventDefault();
      return;
    }

    if (this.options.handleKeyDownBeforeCommand?.(keyboardEvent) === true) {
      event.preventDefault();
      this.cancelTransientInputState();
      return;
    }

    if (this.blockUnownedInput(event)) {
      return;
    }

    if (
      this.applyImeResult(
        this.imeEngine.handleKeyDown({
          key: keyboardEvent.key,
          keyCode: keyboardEvent.keyCode,
          isComposing: keyboardEvent.isComposing
        }),
        event
      )
    ) {
      return;
    }

    this.resultApplier.applyInputResult(
      "keydown",
      this.controller.handleKeyDown({
        key: keyboardEvent.key,
        keyCode: keyboardEvent.keyCode,
        altKey: keyboardEvent.altKey,
        ctrlKey: keyboardEvent.ctrlKey,
        metaKey: keyboardEvent.metaKey,
        shiftKey: keyboardEvent.shiftKey,
        preventDefault: preventDefaultOf(event)
      })
    );
  }

  /**
   * Routes keyboard gesture completion through ProseMirror-style DOM props.
   *
   * @param event - Browser keyup event.
   */
  handleKeyUp(event: Event): void {
    if (this.blockUnownedInput(event)) return;
    this.options.editor.view.dispatchEvent(event);
  }

  /**
   * Handles browser input residue after native text or IME events.
   *
   * @param event - Browser input event.
   */
  handleInput(event: Event): void {
    const inputEvent = event as InputEvent;

    if (this.blockUnownedInput(event) || this.blockReadOnlyEditingInput()) {
      return;
    }
    const inputValue = this.readInputValue();
    const result = this.imeEngine.handleInput({
      inputType: inputEvent.inputType,
      data: inputEvent.data,
      isComposing: inputEvent.isComposing,
      inputValue
    });

    if (this.applyImeResult(result, event)) {
      return;
    }

    if (inputValue.length === 0) {
      if (result.clearInput) {
        this.resultApplier.clearInputProxyValue();
      }
      return;
    }

    if (this.resultApplier.consumeInputEcho(inputValue)) {
      return;
    }

    const inputResult = this.controller.handlePaste({
      clipboardData: null,
      inputValue,
      preventDefault: preventDefaultOf(event)
    });

    if (!this.resultApplier.applyInputResult("input", inputResult) && result.clearInput) {
      this.resultApplier.clearInputProxyValue();
    }
  }

  /**
   * Copies the editor selection through the canvas clipboard bridge.
   *
   * @param event - Browser clipboard event.
   */
  handleCopy(event: Event): void {
    if (this.blockUnownedInput(event)) {
      return;
    }

    this.controller.handleCopy({
      clipboardData: (event as ClipboardEvent).clipboardData,
      preventDefault: preventDefaultOf(event)
    });
  }

  /**
   * Cuts the editor selection through the canvas clipboard bridge.
   *
   * @param event - Browser clipboard event.
   */
  handleCut(event: Event): void {
    if (this.blockUnownedInput(event) || this.blockReadOnlyEditingInput()) {
      return;
    }

    this.resultApplier.applyClipboardResult(
      "cut",
      this.controller.handleCut({
        clipboardData: (event as ClipboardEvent).clipboardData,
        preventDefault: preventDefaultOf(event)
      }),
      true
    );
  }

  /**
   * Pastes browser clipboard data into the editor selection.
   *
   * @param event - Browser clipboard event.
   */
  handlePaste(event: Event): void {
    if (this.blockUnownedInput(event) || this.blockReadOnlyEditingInput()) {
      return;
    }

    this.resultApplier.applyClipboardResult(
      "paste",
      this.controller.handlePaste({
        clipboardData: (event as ClipboardEvent).clipboardData,
        inputValue: this.readInputValue(),
        preventDefault: preventDefaultOf(event)
      }),
      true
    );
  }

  /**
   * Marks the beginning of an IME composition session.
   *
   * @param event - Browser composition event.
   */
  handleCompositionStart(event: Event): void {
    this.routeComposition(event, "start");
  }

  /**
   * Updates visible IME preedit text.
   *
   * @param event - Browser composition event.
   */
  handleCompositionUpdate(event: Event): void {
    this.routeComposition(event, "update");
  }

  /**
   * Commits finalized IME text into the editor.
   *
   * @param event - Browser composition event.
   */
  handleCompositionEnd(event: Event): void {
    this.routeComposition(event, "end");
  }

  /**
   * Routes one composition phase through the controller, then the IME engine.
   *
   * @param event - Browser composition event.
   * @param phase - Composition phase; the controller only tracks start and update.
   */
  private routeComposition(event: Event, phase: "start" | "update" | "end"): void {
    if (this.blockUnownedInput(event) || this.blockReadOnlyEditingInput()) {
      return;
    }

    const data = (event as CompositionEvent).data;
    if (phase === "start") this.controller.handleCompositionStart({ data });
    else if (phase === "update") this.controller.handleCompositionUpdate({ data });
    const input = { data, inputValue: this.readInputValue() };
    this.applyImeResult(
      phase === "start" ? this.imeEngine.handleCompositionStart(input)
        : phase === "update" ? this.imeEngine.handleCompositionUpdate(input)
          : this.imeEngine.handleCompositionEnd(input),
      event
    );
  }

  /** @param event - Browser focus event marking this view focused. */
  handleFocus(event: FocusEvent): void {
    this.focus.handleFocus(event);
  }

  /** @param event - Browser blur event; clears transient IME state. */
  handleBlur(event: FocusEvent): void {
    this.focus.handleBlur(event);
  }

  /** Claims document-level input ownership and cancels any previous mounted input. */
  claimFocusOwnership(): void {
    this.focus.claim();
  }

  /** Releases document-level input ownership and clears transient IME residue. */
  releaseFocusOwnership(): void {
    this.focus.release();
  }

  /** Clears IME/controller/input-proxy state without committing preedit text. */
  cancelTransientInputState(): void {
    this.readTextContext()?.cancel();
    this.controller.cancelComposition();
    this.imeEngine.handleBlur();
    this.resultApplier.clearTransientState();
  }

  /**
   * Applies a native replacement after its source range has been accepted.
   * @param replacement - Text delta without the surrounding native context.
   * @param event - Original input event used for live ownership checks.
   */
  handleTextContextInput(replacement: NativeTextReplacement, event: Event): void {
    if (this.blockUnownedInput(event) || this.blockReadOnlyEditingInput()) return;
    const result = replacement.text.length === 0
      ? this.controller.handleBeforeInput({ inputType: "deleteContentBackward" })
      : replacement.text.includes("\n")
        ? this.controller.handlePaste({ clipboardData: null, inputValue: replacement.text })
        : this.controller.handleTextInput(replacement.text);
    this.resultApplier.applyInputResult("input", result);
  }

  /** @returns Native residue or normalized preedit without the reader context. */
  private readInputValue(): string {
    return this.readTextContext()?.readInputValue() ?? this.options.inputProxy.value;
  }

  /**
   * Restarts the browser-owned input session when JS state reset is not enough.
   */
  restartNativeInputSession(): void {
    this.restartingNativeInputSession = true;
    try {
      this.resultApplier.restartNativeInputSession();
    } finally {
      this.restartingNativeInputSession = false;
    }
  }

  /**
   * Applies an IME result and mirrors cancellation into the input controller.
   *
   * @param result - Result returned by the reusable IME engine.
   * @param event - Browser event that may need default prevention.
   * @returns Whether the IME result consumed the browser event.
   */
  private applyImeResult(result: QuireImeEventResult, event?: Event): boolean {
    const handled = this.resultApplier.applyImeResult(result, event);

    if (handled && !result.isComposing && result.commitText === undefined) {
      this.controller.cancelComposition();
    }

    return handled;
  }

  /**
   * Prevents browser input from falling back to a stale PM story selection.
   *
   * @param event - Browser event that must not reach native or editor mutation.
   * @returns Whether current mounted ownership blocks the event.
   */
  private blockUnownedInput(event: Event): boolean {
    if (this.options.shouldRouteInput?.() !== false) {
      return false;
    }

    event.preventDefault();
    this.cancelTransientInputState();
    return true;
  }

  /**
   * Stops editing events when the live mounted view is read-only.
   *
   * Native textarea `readOnly` blocks browser mutation. This semantic gate is
   * still required for focused transitions and queued events that can reach the
   * controller before or around the corresponding DOM state write.
   *
   * @returns Whether the current editing event must stop before dispatch.
   */
  private blockReadOnlyEditingInput(): boolean {
    if (readQuireMountedInputEditable(this.options)) {
      return false;
    }

    this.cancelTransientInputState();
    return true;
  }
}

/**
 * Binds a browser event's default-prevention for controller callbacks.
 *
 * @param event - Browser event whose default action the controller may cancel.
 * @returns Callback that prevents the event's default action.
 */
function preventDefaultOf(event: Event): () => void {
  return () => event.preventDefault();
}
