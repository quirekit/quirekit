import type { QuireAiSourcePendingChanges } from "@quirekit/ai-runtime/source";
import { StateEffect, StateField, type EditorState, type Range } from "@quirekit/cm-state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@quirekit/cm-view";

/** Replaces the highlighted AI changes; null clears them. */
export const setMsfeAiReview = StateEffect.define<QuireAiSourcePendingChanges | null>();

/** Text the AI removed, shown struck through where it was until the request is reviewed. */
class RemovedText extends WidgetType {
  /** @param text - Removed text. */
  constructor(readonly text: string) { super(); }

  /** @param other - Previous widget. @returns Whether it shows the same text. */
  override eq(other: RemovedText): boolean { return other.text === this.text; }

  /** @returns Read-only struck-through text. */
  toDOM(): HTMLElement {
    const element = document.createElement("del");
    element.className = "msfe-ai-removed";
    element.textContent = this.text;
    element.setAttribute("contenteditable", "false");
    return element;
  }

  /** @returns Whether the editor ignores events inside the widget. */
  override ignoreEvent(): boolean { return true; }
}

/**
 * @param changes - Pending AI changes.
 * @param state - State they apply to.
 * @returns Decorations marking inserted text and showing removed text.
 */
function build(changes: QuireAiSourcePendingChanges | null, state: EditorState): DecorationSet {
  if (changes === null) return Decoration.none;
  const length = state.doc.length;
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of changes.inserted) {
    const start = Math.min(from, length), end = Math.min(to, length);
    if (end > start) ranges.push(Decoration.mark({ class: "msfe-ai-inserted" }).range(start, end));
  }
  for (const { pos, text } of changes.removed) ranges.push(Decoration.widget({ widget: new RemovedText(text), side: -1 }).range(Math.min(pos, length)));
  return Decoration.set(ranges, true);
}

/** Highlights of AI changes awaiting review; they map through edits until replaced. */
export const msfeAiReviewField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) if (effect.is(setMsfeAiReview)) next = build(effect.value, transaction.state);
    return next;
  },
  provide: field => EditorView.decorations.from(field)
});

/** Styles of the highlights, in the brand blue for added text and muted red for removed text. */
export const msfeAiReviewTheme = EditorView.baseTheme({
  ".msfe-ai-inserted": { backgroundColor: "rgba(75, 103, 242, 0.14)", borderBottom: "1px solid rgba(75, 103, 242, 0.6)" },
  ".msfe-ai-removed": { color: "#b42318", opacity: "0.75", textDecoration: "line-through" }
});
