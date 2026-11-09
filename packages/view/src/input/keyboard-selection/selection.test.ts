import { createEditor, Node, readQuireSelectionNavigation } from "@quirekit/core";
import { AllSelection, TextSelection, type EditorState } from "@quirekit/pm";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it } from "vitest";
import type { QuireKeyboardInputEvent } from "../types";
import { createQuireKeyboardSelectionTransaction } from "./selection";

describe("canvas keyboard selection helper", () => {
  for (const modifier of ["ctrlKey", "metaKey"] as const) {
    for (const scope of ["document", "body", "story"] as const) {
      it(`selects ${scope} with ${modifier} without requesting viewport movement`, () => {
        const state = createEditorStateWithParagraph("abcdef");
        const boundary = {
          sourceId: "selection-owner",
          from: 0,
          to: state.doc.content.size,
          selectionFrom: 1,
          selectionTo: 7
        };
        const options = {
          event: createKeyboardEvent("a", { [modifier]: true }),
          ...(scope === "body"
            ? { selectionScopeBoundary: { ...boundary, regionKind: "body" as const } }
            : scope === "story"
              ? { storyCommandBoundary: { ...boundary, regionKind: "footer" as const } }
              : {})
        };
        let current = state;

        // Repeated Select All must preserve the same viewport intent and range.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const transaction = createQuireKeyboardSelectionTransaction({ ...options, state: current });
          expect(transaction).not.toBeNull();
          expect(transaction!.selection).toBeInstanceOf(scope === "document" ? AllSelection : TextSelection);
          expect(transaction!.selection).toMatchObject({
            from: scope === "document" ? 0 : boundary.selectionFrom,
            to: scope === "document" ? state.doc.content.size : boundary.selectionTo
          });
          expect(transaction!.docChanged).toBe(false);
          expect(transaction!.scrolledIntoView).toBe(false);
          expect(readQuireSelectionNavigation(transaction!)).toBeUndefined();
          current = current.apply(transaction!);
          expect(current.doc).toBe(state.doc);
        }

        const navigation = createQuireKeyboardSelectionTransaction({
          state: current,
          event: createKeyboardEvent("ArrowLeft")
        });
        expect(navigation!.selection.empty).toBe(true);
        expect(navigation!.scrolledIntoView).toBe(true);
        expect(readQuireSelectionNavigation(navigation!)).toBeUndefined();
      });
    }
  }

  it("reveals the head when document-boundary expansion selects all text", () => {
    const state = createEditorStateWithParagraph("abcdef");
    const transaction = createQuireKeyboardSelectionTransaction({
      state,
      event: createKeyboardEvent("End", { ctrlKey: true, shiftKey: true })
    });

    expect(transaction!.selection).toMatchObject({ anchor: 1, head: 7 });
    expect(transaction!.scrolledIntoView).toBe(true);
  });

  it("collapses word navigation ranges to the requested edge", () => {
    const state = createEditorStateWithParagraph("one two three");
    const rangedState = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 5, 8))
    );

    const transaction = createQuireKeyboardSelectionTransaction({
      state: rangedState,
      event: createKeyboardEvent("ArrowRight", { altKey: true })
    });

    expect(transaction).not.toBeNull();
    expect(transaction?.selection.empty).toBe(true);
    expect(transaction?.selection.from).toBe(8);
    expect(transaction?.scrolledIntoView).toBe(true);
  });

  describe("over an atomic inline node with text content", () => {
    // "a" + guide("b") + "c": positions 1|a|2 [3 b 4] 5|c|6; the guide spans 2..5.
    it.each([
      { from: 2, key: "ArrowRight", expected: 5 },
      { from: 5, key: "ArrowLeft", expected: 2 },
      { from: 3, key: "ArrowRight", expected: 5 }
    ])("moves $key from $from to $expected without entering the node", ({ from, key, expected }) => {
      const state = createEditorStateWithInlineAtom(from);
      const transaction = createQuireKeyboardSelectionTransaction({ state, event: createKeyboardEvent(key) });

      expect(transaction!.selection).toBeInstanceOf(TextSelection);
      expect(transaction!.selection.toJSON()).toEqual({ type: "text", anchor: expected, head: expected });
    });

    it("extends across the whole node", () => {
      const state = createEditorStateWithInlineAtom(1);
      const transaction = createQuireKeyboardSelectionTransaction({
        state: state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 2))),
        event: createKeyboardEvent("ArrowRight", { shiftKey: true })
      });

      expect(transaction!.selection.toJSON()).toEqual({ type: "text", anchor: 1, head: 5 });
    });
  });

  it("ignores non-selection keyboard events", () => {
    const state = createEditorStateWithParagraph("abc");

    expect(
      createQuireKeyboardSelectionTransaction({
        state,
        event: createKeyboardEvent("Enter")
      })
    ).toBeNull();
  });

  it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"])(
    "declares only the actual logical head movement for Shift+%s", key => {
      const initial = createEditorStateWithParagraph("abcdef");
      const state = initial.apply(initial.tr.setSelection(TextSelection.create(initial.doc, 1, 4)));
      const tr = createQuireKeyboardSelectionTransaction({ state, event: createKeyboardEvent(key, { shiftKey: true }) });
      expect(tr).not.toBeNull();
      expect(readQuireSelectionNavigation(tr!)).toEqual({ direction: Math.sign(tr!.selection.head - 4) });
      expect(tr!.steps).toEqual([]);
      expect(tr!.selection.anchor).toBe(1);
    }
  );

  it("uses resolved PM movement instead of assuming physical arrow direction", () => {
    const state = createEditorStateWithParagraph("abcdef");
    const tr = createQuireKeyboardSelectionTransaction({ state, event: createKeyboardEvent("ArrowUp", { shiftKey: true }),
      resolveVerticalCaretPosition: () => ({ pos: 3 }) });
    expect(readQuireSelectionNavigation(tr!)).toEqual({ direction: 1 });
  });
});

/**
 * Creates a ProseMirror editor state with one starter-kit paragraph.
 *
 * @param text - Paragraph text content.
 * @returns Editor state containing the requested paragraph.
 */
function createEditorStateWithParagraph(text: string): EditorState {
  const editor = createEditor({
    extensions: [StarterKit]
  });
  const docType = editor.state.schema.nodes.doc;
  const paragraphType = editor.state.schema.nodes.paragraph;

  if (!docType || !paragraphType) {
    throw new Error("Starter kit schema did not provide doc and paragraph nodes.");
  }

  editor.setContent(
    docType.create(
      null,
      paragraphType.create(null, text ? editor.state.schema.text(text) : null)
    )
  );

  return editor.state.pm;
}

/** Inline object whose base text is content but never a caret target, like a phonetic guide. */
const InlineAtomWithText = Node.create({
  name: "inlineAtomWithText", inline: true, group: "inline", content: "text*", atom: true, selectable: true
});

/**
 * Creates "a" + atomic inline node holding "b" + "c" with a collapsed caret.
 *
 * @param caret - Collapsed caret position.
 * @returns Editor state for atomic inline navigation.
 */
function createEditorStateWithInlineAtom(caret: number): EditorState {
  const editor = createEditor({ extensions: [StarterKit, InlineAtomWithText] });
  const { schema } = editor.state;
  editor.setContent(schema.nodes.doc!.create(null, schema.nodes.paragraph!.create(null, [
    schema.text("a"), schema.nodes.inlineAtomWithText!.create(null, schema.text("b")), schema.text("c")
  ])));
  const state = editor.state.pm;
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, caret)));
}

/**
 * Creates the keyboard event shape consumed by selection navigation helpers.
 *
 * @param key - KeyboardEvent key value.
 * @param overrides - Optional modifier overrides.
 * @returns Keyboard event-like object for tests.
 */
function createKeyboardEvent(
  key: string,
  overrides: Partial<QuireKeyboardInputEvent> = {}
): QuireKeyboardInputEvent {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides
  };
}
