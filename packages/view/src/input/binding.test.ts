// @vitest-environment happy-dom
import { createEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it, vi } from "vitest";
import { createQuireEditorInputBinding } from "./binding";

describe("QuireMountedInputBinding", () => {
  it("preserves ordinary pointer focus while retaining an explicit forced restart", () => {
    const fixture = createFocusedBinding();
    try {
      fixture.inputProxy.value = "residue";
      fixture.binding.resetTransientState({ restartNativeInput: "if-needed" });
      fixture.binding.focus();
      expect(document.activeElement).toBe(fixture.inputProxy);
      expect(fixture.blur).not.toHaveBeenCalled();
      expect(fixture.inputProxy.value).toBe("");
      expect(fixture.inputProxy.selectionStart).toBe(0);

      fixture.binding.resetTransientState({ restartNativeInput: true });
      expect(fixture.blur).toHaveBeenCalledOnce();
    } finally {
      fixture.destroy();
    }
  });

  it.each([
    ["active composition", () => new CompositionEvent("compositionstart")],
    ["completed composition", () => new CompositionEvent("compositionend", { data: "你" })],
    ["compatibility key", () => new KeyboardEvent("keydown", { keyCode: 229 })],
    ["composing key", () => new KeyboardEvent("keydown", { key: "a", isComposing: true })],
    ["composing input", () => new InputEvent("input", { isComposing: true })],
    ["composition intent", () => new InputEvent("beforeinput", { inputType: "insertCompositionText" })],
    ["composition commit intent", () => new InputEvent("beforeinput", { inputType: "insertFromComposition" })]
  ] as const)("restarts once after %s even if JS transient state was cleared", (_name, createEvent) => {
    const fixture = createFocusedBinding();
    try {
      fixture.inputProxy.dispatchEvent(createEvent());
      const committedDoc = fixture.editor.state.doc;
      fixture.binding.resetTransientState();
      fixture.binding.resetTransientState({ restartNativeInput: "if-needed" });
      expect(fixture.blur).toHaveBeenCalledOnce();
      expect(fixture.editor.state.doc).toBe(committedDoc);

      fixture.binding.focus();
      fixture.binding.resetTransientState({ restartNativeInput: "if-needed" });
      expect(fixture.blur).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(fixture.inputProxy);
    } finally {
      fixture.destroy();
    }
  });

  it("clears native session evidence on an external blur without affecting another binding", () => {
    const first = createFocusedBinding();
    const second = createFocusedBinding();
    try {
      second.inputProxy.dispatchEvent(new CompositionEvent("compositionstart"));
      second.binding.blur();
      second.blur.mockClear();
      first.binding.focus();
      first.blur.mockClear();
      first.binding.resetTransientState({ restartNativeInput: "if-needed" });
      expect(first.blur).not.toHaveBeenCalled();

      second.binding.focus();
      second.binding.resetTransientState({ restartNativeInput: "if-needed" });
      expect(second.blur).not.toHaveBeenCalled();
    } finally {
      second.destroy();
      first.destroy();
    }
  });

  it("focuses the read-only proxy for copy after clearing transient input", () => {
    const editor = createEditor({
      extensions: [StarterKit.configure({ undoRedo: false })],
      content: { type: "doc", content: [{ type: "paragraph" }] }
    });
    const inputProxy = document.createElement("textarea");
    let editable = false;
    const binding = createQuireEditorInputBinding({
      editor,
      inputProxy,
      readEditable: () => editable
    });
    document.body.appendChild(inputProxy);
    inputProxy.readOnly = true;
    inputProxy.value = "stale preedit";

    binding.focus();

    expect(document.activeElement).toBe(inputProxy);
    expect(inputProxy.readOnly).toBe(true);
    expect(inputProxy.value).toBe("");

    editable = true;
    inputProxy.readOnly = false;
    binding.focus();

    expect(document.activeElement).toBe(inputProxy);

    binding.destroy();
    inputProxy.blur();
    binding.focus();
    expect(document.activeElement).not.toBe(inputProxy);
    inputProxy.remove();
    editor.destroy();
  });
});

/** @returns Focused real textarea binding with observable native blur and explicit cleanup. */
function createFocusedBinding() {
  const editor = createEditor({
    extensions: [StarterKit.configure({ undoRedo: false })],
    content: { type: "doc", content: [{ type: "paragraph" }] }
  });
  const inputProxy = document.createElement("textarea");
  document.body.appendChild(inputProxy);
  const binding = createQuireEditorInputBinding({ editor, inputProxy });
  binding.focus();
  const blur = vi.spyOn(inputProxy, "blur");
  return {
    editor, inputProxy, binding, blur,
    /** Releases listeners, browser element and editor after every assertion. */
    destroy(): void {
      binding.destroy();
      inputProxy.remove();
      editor.destroy();
    }
  };
}
