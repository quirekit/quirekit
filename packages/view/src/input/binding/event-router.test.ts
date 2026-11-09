import { createEditor } from "@quirekit/core";
import type { QuireClipboardData } from "@quirekit/clipboard";
import { TextSelection } from "@quirekit/pm";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it, vi } from "vitest";
import type { QuireInteractionSelectionTarget } from "@quirekit/view-engine";
import type {
  QuireEditorInputBindingOptions,
  QuireEditorInputBindingUpdate
} from "../types";
import { QuireMountedInputEventRouter } from "./event-router";

describe("QuireMountedInputEventRouter command routing", () => {
  it("routes keyup as a mounted selection-gesture completion event", () => {
    const editor = createEditorWithParagraph("abc");
    const inputProxy = createFakeInputProxy();
    const dispatchEvent = vi.spyOn(editor.view, "dispatchEvent");
    const router = new QuireMountedInputEventRouter(
      createBindingOptions({ editor, inputProxy }),
      {}
    );
    const event = new KeyboardEvent("keyup", {
      key: "ArrowRight",
      shiftKey: true
    });

    router.handleKeyUp(event);

    expect(dispatchEvent).toHaveBeenCalledWith(event);
    editor.destroy();
  });

  it("routes mounted keyboard, beforeinput, clipboard, and input residue through the active interaction target", () => {
    const editor = createEditorWithParagraph("abc");
    const inputProxy = createFakeInputProxy();
    const updates: QuireEditorInputBindingUpdate[] = [];
    const interactionTarget = createObjectInteractionSelectionTarget();
    const router = new QuireMountedInputEventRouter(
      createBindingOptions({
        editor,
        inputProxy,
        getInteractionTarget: () => interactionTarget,
        onUpdate: (update) => {
          updates.push(update);
        }
      }),
      {}
    );

    editor.dispatchTransaction(
      editor.state.pm.tr.setSelection(TextSelection.create(editor.state.doc, 1, 3))
    );

    const keydown = createKeyboardEvent("Backspace");
    router.handleKeyDown(keydown);

    const textBeforeInput = createBeforeInputEvent("insertText", "Z");
    router.handleBeforeInput(textBeforeInput);

    const paragraphBeforeInput = createBeforeInputEvent("insertParagraph");
    router.handleBeforeInput(paragraphBeforeInput);

    const lineBreakBeforeInput = createBeforeInputEvent("insertLineBreak");
    router.handleBeforeInput(lineBreakBeforeInput);

    const extendedDeleteBeforeInput =
      createBeforeInputEvent("deleteWordBackward");
    router.handleBeforeInput(extendedDeleteBeforeInput);

    const pasteBeforeInput = createBeforeInputEvent("insertFromPaste", "Z");
    router.handleBeforeInput(pasteBeforeInput);

    const cutBeforeInput = createBeforeInputEvent("deleteByCut");
    router.handleBeforeInput(cutBeforeInput);

    const copy = createClipboardEvent();
    router.handleCopy(copy);

    const cut = createClipboardEvent();
    router.handleCut(cut);

    const paste = createClipboardEvent({ "text/plain": "Z" });
    router.handlePaste(paste);

    inputProxy.value = "native";
    const inputResidue = createBeforeInputEvent("insertText", "native");
    router.handleInput(inputResidue);

    expect(keydown.prevented).toBe(true);
    expect(textBeforeInput.prevented).toBe(true);
    expect(paragraphBeforeInput.prevented).toBe(true);
    expect(lineBreakBeforeInput.prevented).toBe(true);
    expect(extendedDeleteBeforeInput.prevented).toBe(true);
    expect(pasteBeforeInput.prevented).toBe(true);
    expect(cutBeforeInput.prevented).toBe(true);
    expect(copy.prevented).toBe(true);
    expect(cut.prevented).toBe(true);
    expect(paste.prevented).toBe(true);
    expect(inputResidue.prevented).toBe(true);
    expect(copy.clipboardData.getData("text/plain")).toBe("");
    expect(cut.clipboardData.getData("text/plain")).toBe("");
    expect(editor.state.doc.textContent).toBe("abc");
    expect(editor.state.pm.selection.from).toBe(1);
    expect(editor.state.pm.selection.to).toBe(3);
    expect(updates).toEqual([
      {
        source: "keydown",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "beforeinput",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "beforeinput",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "beforeinput",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "beforeinput",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "beforeinput",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "beforeinput",
        result: { handled: true, docChanged: false },
        reason: "selection"
      },
      {
        source: "input",
        result: { handled: true, docChanged: false },
        reason: "selection"
      }
    ]);
  });

  it("blocks keyboard, clipboard, and IME events without story editing ownership", () => {
    const editor = createEditorWithParagraph("abc");
    const inputProxy = createFakeInputProxy();
    const router = new QuireMountedInputEventRouter(
      createBindingOptions({
        editor,
        inputProxy,
        shouldRouteInput: () => false
      }),
      {}
    );
    editor.dispatchTransaction(
      editor.state.pm.tr.setSelection(TextSelection.create(editor.state.doc, 2))
    );

    const beforeInput = createBeforeInputEvent("insertText", "X");
    const keydown = createKeyboardEvent("ArrowRight");
    const paste = createClipboardEvent({ "text/plain": "X" });
    const compositionStart = createCompositionEvent("x");
    const compositionUpdate = createCompositionEvent("xi");
    const compositionEnd = createCompositionEvent("西");

    router.handleBeforeInput(beforeInput);
    router.handleKeyDown(keydown);
    router.handlePaste(paste);
    router.handleCompositionStart(compositionStart);
    router.handleCompositionUpdate(compositionUpdate);
    router.handleCompositionEnd(compositionEnd);

    expect(editor.state.doc.textContent).toBe("abc");
    expect(editor.state.pm.selection.from).toBe(2);
    expect(beforeInput.prevented).toBe(true);
    expect(keydown.prevented).toBe(true);
    expect(paste.prevented).toBe(true);
    expect(compositionStart.prevented).toBe(true);
    expect(compositionUpdate.prevented).toBe(true);
    expect(compositionEnd.prevented).toBe(true);
  });

  it("re-evaluates live editability before every editing event while preserving copy", () => {
    const editor = createEditorWithParagraph("abc");
    const inputProxy = createFakeInputProxy();
    const handleKeyDownBeforeCommand = vi.fn(() => false);
    const updates: QuireEditorInputBindingUpdate[] = [];
    let editable = true;
    const router = new QuireMountedInputEventRouter(
      createBindingOptions({
        editor,
        inputProxy,
        readEditable: () => editable,
        handleKeyDownBeforeCommand,
        onUpdate: (update) => {
          updates.push(update);
        }
      }),
      {}
    );
    editor.dispatchTransaction(
      editor.state.pm.tr.setSelection(TextSelection.create(editor.state.doc, 1, 3))
    );
    router.handleCompositionStart(createCompositionEvent("x"));
    inputProxy.value = "stale-preedit";
    editable = false;
    const beforeInput = createBeforeInputEvent("insertText", "X");
    const keydown = createKeyboardEvent("Enter");
    const input = createBeforeInputEvent("insertText", "native-residue");
    const compositionUpdate = createCompositionEvent("xi");
    const compositionEnd = createCompositionEvent("西");
    const cut = createClipboardEvent();
    const paste = createClipboardEvent({ "text/plain": "X" });
    const copy = createClipboardEvent();

    router.handleBeforeInput(beforeInput);
    router.handleKeyDown(keydown);
    inputProxy.value = "native-residue";
    router.handleInput(input);
    router.handleCompositionUpdate(compositionUpdate);
    router.handleCompositionEnd(compositionEnd);
    router.handleCut(cut);
    router.handlePaste(paste);
    router.handleCopy(copy);

    expect(editor.state.doc.textContent).toBe("abc");
    expect(editor.state.pm.selection.from).toBe(1);
    expect(editor.state.pm.selection.to).toBe(3);
    expect(inputProxy.value).toBe("");
    expect(handleKeyDownBeforeCommand).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(copy.prevented).toBe(true);
    expect(copy.clipboardData.getData("text/plain")).toBe("ab");

    const backspace = createKeyboardEvent("Backspace");
    const tab = createKeyboardEvent("Tab");
    const arrow = createKeyboardEvent("ArrowLeft");
    router.handleKeyDown(backspace);
    router.handleKeyDown(tab);
    router.handleKeyDown(arrow);
    expect(backspace.prevented).toBe(true);
    expect(tab.prevented).toBe(false);
    expect(arrow.prevented).toBe(false);
    expect(editor.state.doc.textContent).toBe("abc");
    expect(updates).toEqual([]);

    editable = true;
    router.handleBeforeInput(createBeforeInputEvent("insertText", "Y"));

    expect(editor.state.doc.textContent).toBe("Yc");
    expect(updates).toHaveLength(1);
  });

  it("lets the mounted editing mode consume Escape before PM commands", () => {
    const editor = createEditorWithParagraph("abc");
    const handleKeyDownBeforeCommand = vi.fn(() => true);
    const router = new QuireMountedInputEventRouter(
      createBindingOptions({
        editor,
        inputProxy: createFakeInputProxy(),
        shouldRouteInput: () => false,
        handleKeyDownBeforeCommand
      }),
      {}
    );
    const escape = createKeyboardEvent("Escape");

    router.handleKeyDown(escape);

    expect(handleKeyDownBeforeCommand).toHaveBeenCalledWith(escape);
    expect(escape.prevented).toBe(true);
  });

  it("reports external native blur as mounted input ownership loss", () => {
    const editor = createEditorWithParagraph("abc");
    const onInputOwnershipLost = vi.fn();
    const router = new QuireMountedInputEventRouter(
      createBindingOptions({
        editor,
        inputProxy: createFakeInputProxy(),
        onInputOwnershipLost
      }),
      {}
    );

    router.handleBlur(new FocusEvent("blur"));

    expect(onInputOwnershipLost).toHaveBeenCalledOnce();
  });
});

/**
 * Creates an editor with one paragraph for mounted input tests.
 *
 * @param text - Paragraph text content.
 * @returns Editor with one paragraph.
 */
function createEditorWithParagraph(text: string) {
  return createEditor({
    extensions: [StarterKit.configure({ undoRedo: false })],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }]
        }
      ]
    }
  });
}

/**
 * Creates binding options for an event-router test.
 *
 * @param overrides - Options that vary per test.
 * @returns Binding options with a mounted input proxy.
 */
function createBindingOptions(
  overrides: QuireEditorInputBindingOptions
): QuireEditorInputBindingOptions {
  return {
    ...overrides
  };
}

/**
 * Creates a minimal composition event with inspection helpers.
 *
 * @param data - Browser composition payload.
 * @returns Composition event-like object.
 */
function createCompositionEvent(data: string): Event & {
  readonly data: string;
  readonly prevented: boolean;
} {
  let prevented = false;

  return {
    data,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    }
  } as Event & {
    readonly data: string;
    readonly prevented: boolean;
  };
}

/**
 * Creates object interaction target facts for command-routing tests.
 *
 * @returns Object interaction target facts.
 */
function createObjectInteractionSelectionTarget(): QuireInteractionSelectionTarget {
  return {
    domain: "object",
    commandTarget: "object",
    hitKind: "object"
  };
}

/**
 * Creates the fake textarea surface consumed by input binding code.
 *
 * @returns Textarea-like object with writable value and selection reset.
 */
function createFakeInputProxy(): HTMLTextAreaElement {
  return document.createElement("textarea");
}

/**
 * Creates a minimal keyboard event with inspection helpers.
 *
 * @param key - Keyboard key value.
 * @returns Keyboard event-like object.
 */
function createKeyboardEvent(key: string): Event & {
  readonly key: string;
  readonly keyCode: number;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
  readonly prevented: boolean;
} {
  let prevented = false;

  return {
    key,
    keyCode: key === "Backspace" ? 8 : 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    }
  } as Event & {
    readonly key: string;
    readonly keyCode: number;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
    readonly isComposing: boolean;
    readonly prevented: boolean;
  };
}

/**
 * Creates a minimal beforeinput event with inspection helpers.
 *
 * @param inputType - Browser inputType value.
 * @param data - Text payload for the input.
 * @returns Input event-like object.
 */
function createBeforeInputEvent(
  inputType: string,
  data: string | null = null
): Event & {
  readonly inputType: string;
  readonly data: string | null;
  readonly isComposing: boolean;
  readonly prevented: boolean;
} {
  let prevented = false;

  return {
    inputType,
    data,
    isComposing: false,
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    }
  } as Event & {
    readonly inputType: string;
    readonly data: string | null;
    readonly isComposing: boolean;
    readonly prevented: boolean;
  };
}

/**
 * Creates a minimal clipboard event with inspection helpers.
 *
 * @param initialData - Initial MIME data entries.
 * @returns Clipboard event-like object.
 */
function createClipboardEvent(
  initialData: Record<string, string> = {}
): Event & {
  readonly clipboardData: QuireClipboardData;
  readonly prevented: boolean;
} {
  let prevented = false;

  return {
    clipboardData: createClipboardData(initialData),
    preventDefault() {
      prevented = true;
    },
    get prevented() {
      return prevented;
    }
  } as Event & {
    readonly clipboardData: QuireClipboardData;
    readonly prevented: boolean;
  };
}

/**
 * Creates a minimal clipboard data adapter.
 *
 * @param initialData - Initial MIME data entries.
 * @returns Clipboard data adapter for input tests.
 */
function createClipboardData(
  initialData: Record<string, string>
): QuireClipboardData {
  const data = new Map(Object.entries(initialData));

  return {
    get types() {
      return [...data.keys()];
    },
    getData(type) {
      return data.get(type) ?? "";
    },
    setData(type, value) {
      data.set(type, value);
    }
  };
}
// @vitest-environment happy-dom
