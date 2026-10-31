import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from "vue";
import { EditorSelection, type EditorState } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import type { MsfeEditor, SourceAnchor } from "@quirekit/msfe-core";
import { commentsState, getComments, type CommentMention, type CommentsController, type CommentsState, type CommentThreadView } from "@quirekit/msfe-comments";
import { projectQuireCommentAnchor } from "@quirekit/ui";
import type { QuireKitCommentPosition } from "@quirekit/ui/vue";
import { anchorsChanged } from "./anchors";
import { commentCardModel } from "./model";
import type { MdCommentsLayout } from "@quirekit/md-editor/vue";
import type { MdCommentCardModel, MdCommentsOptions } from "../types";

/** Editor width that keeps a readable column beside the comment rail. */
const sideMinWidth = 1040;

/** Reactive inputs of the comment workspace. */
export interface MdCommentsInput {
  /** Current editor. */ readonly editor: () => MsfeEditor | undefined;
  /** Accepted editor state. */ readonly state: () => EditorState | undefined;
  /** Host configuration, or undefined when comments are off. */ readonly options: () => MdCommentsOptions | undefined;
  /** Editor root, whose width decides the presentation. */ readonly root: Ref<HTMLElement | null>;
  /** Whether the product uses the centered document layout on a wide screen. */ readonly wide: () => boolean;
  /** Quote label of comments on the whole document. */ readonly documentLabel?: () => string;
  /** Whether a document comment section is shown after the document, so its draft opens there instead of in the list. */ readonly documentSection?: () => boolean;
}

/**
 * Owns comment presentation state: thread views, draft, side-rail anchors and selection-driven focus.
 *
 * Work bounds: views rebuild only when the comment state object changes; anchors are measured at most
 * once per frame from CodeMirror's height map, in O(visible threads), and only while the side rail shows.
 *
 * @param input - Reactive editor, options and geometry owners.
 * @returns Presentation state and actions.
 */
export function useMdComments(input: MdCommentsInput) {
  const controller = computed<CommentsController | null>(() => { const editor = input.editor(); return editor && input.options() ? getComments(editor) : null; });
  const snapshot = shallowRef<CommentsState>(), views = shallowRef<readonly CommentThreadView[]>([]);
  const draft = shallowRef<SourceAnchor | null>(null), panelOpen = shallowRef(false), width = shallowRef(0);
  const anchors = shallowRef<ReadonlyMap<string, number>>(new Map()), rail = shallowRef<HTMLElement | null>(null);
  let frame = 0, lastSelection: EditorSelection | undefined;

  // Phase 1: comment state identity drives view rebuilding; text edits that only map ranges still rebuild once.
  watch([input.state, controller] as const, ([state, owner]) => {
    if (!state || !owner) { snapshot.value = undefined; views.value = []; return; }
    const next = commentsState.read(state);
    if (next !== snapshot.value) { snapshot.value = next; views.value = owner.threads(); schedule(); }
    // Selection inside a thread's range focuses it, like other document editors.
    if (state.selection !== lastSelection) {
      const moved = lastSelection !== undefined && !state.selection.eq(lastSelection); lastSelection = state.selection;
      if (moved) queueMicrotask(() => focusAtSelection(owner));
    }
  }, { immediate: true });

  const options = computed(() => input.options());
  const cards = computed<readonly MdCommentCardModel[]>(() => options.value ? views.value.map(view => commentCardModel(view, options.value!, input.documentLabel?.())) : []);
  /** Comments on the whole document, in creation order. */
  const documentCards = computed(() => cards.value.filter(card => card.view.status === "document"));
  /** Whether a draft for a comment on the whole document is open. */
  const documentDraft = shallowRef(false);
  const railCards = computed(() => cards.value.filter(card => !card.resolved && card.view.range));
  /** Unresolved placed threads in source order: the rail's content and the previous / next sequence. */
  const sequence = computed(() => railCards.value.map(card => ({ id: card.id, from: card.view.range!.from })).sort((left, right) => left.from - right.from));
  const active = computed(() => snapshot.value?.active ?? null);
  const draftQuote = computed(() => {
    void input.state();
    const range = draft.value?.getRange(), editor = input.editor();
    return range && editor ? editor.state.sliceDoc(range.from, Math.min(range.to, range.from + 200)) : undefined;
  });
  const layout = computed<MdCommentsLayout>(() => !controller.value ? "none"
    : input.wide() && width.value >= sideMinWidth && (railCards.value.length > 0 || !!draft.value) ? "side" : "panel");
  /** Cards and the draft that belong in the rail, in source order; positions are measured separately. */
  const railSlots = computed(() => [
    ...railCards.value.map(card => ({ id: card.id, from: card.view.range!.from })),
    ...(draft.value ? [{ id: "draft", from: draft.value.getRange()?.from ?? 0 }] : []),
  ].sort((left, right) => left.from - right.from));
  // Unmeasured slots stay out of the rail, so a new card first renders at its anchor instead of sliding down from the top.
  const railItems = computed(() => railSlots.value.flatMap(slot => anchors.value.has(slot.id) ? [{ ...slot, anchorTop: anchors.value.get(slot.id)! }] : []));

  // Width decides the layout; the root also grows with content height (wrapping, images, folds), which moves anchors.
  watch(input.root, (element, _previous, cleanup) => {
    const Observer = element?.ownerDocument.defaultView?.ResizeObserver;
    if (!element || !Observer) return;
    /** Reads the current width and remeasures anchors. */
    const update = (): void => { width.value = element.getBoundingClientRect().width; schedule(); };
    const observer = new Observer(update);
    observer.observe(element); update();
    cleanup(() => observer.disconnect());
  }, { immediate: true });
  watch([layout, rail, () => railSlots.value.map(item => `${item.id}:${item.from}`).join()] as const, () => schedule());

  /** Phase 2: one geometry read per frame; rail and document share a scroll owner, so scrolling needs no remeasure. */
  function measure(): void {
    frame = 0;
    const editor = input.editor(), element = rail.value, view = editor && EditorView.findFromDOM(editor.element);
    if (layout.value !== "side" || !view) return;
    // The rail mounts with the side layout; measure again once it exists.
    if (!element) { schedule(); return; }
    const railTop = element.getBoundingClientRect().top, length = view.state.doc.length, next = new Map<string, number>();
    /** @param pos - Source offset. @returns Client top of its text, falling back to the height map offscreen. */
    const top = (pos: number): number => view.coordsAtPos(Math.min(pos, length))?.top ?? view.documentTop + view.lineBlockAt(Math.min(pos, length)).top;
    for (const card of railCards.value) next.set(card.id, projectQuireCommentAnchor({ anchorClientY: top(card.view.range!.from), railClientY: railTop }));
    const pending = draft.value?.getRange();
    if (pending) next.set("draft", projectQuireCommentAnchor({ anchorClientY: top(pending.from), railClientY: railTop }));
    const previous = anchors.value;
    if (anchorsChanged(previous, next)) anchors.value = next;
  }

  /** Coalesces state and resize changes into one measurement per frame. */
  function schedule(): void {
    const win = input.editor()?.element.ownerDocument.defaultView;
    if (!frame && win && layout.value === "side") frame = win.requestAnimationFrame(measure);
  }

  /** @param owner - Controller. Focuses the first unresolved thread at the caret, or clears focus outside threads. */
  function focusAtSelection(owner: CommentsController): void {
    const editor = input.editor();
    if (!editor || editor.scope.disposed) return;
    const id = owner.threadsAt(editor.state.selection.main.head)[0] ?? null;
    if (id !== owner.active()) owner.activate(id);
  }

  /** @returns Whether a draft opened for the current selection. */
  function openDraft(): boolean {
    const editor = input.editor(), owner = controller.value, user = input.options()?.user;
    if (!editor || !owner || !user || input.options()?.canComment === false) return false;
    draft.value?.release();
    draft.value = editor.captureAnchor(editor.state.selection.main);
    if (layout.value !== "side") panelOpen.value = true;
    schedule();
    return true;
  }

  /** Abandons the draft. */
  function cancelDraft(): void { draft.value?.release(); draft.value = null; }

  /**
   * Creates the thread on the range captured when the draft opened.
   * @param body - Root message. @param mentions - People mentioned in it.
   */
  function submitDraft(body: string, mentions: readonly CommentMention[] = []): void {
    const owner = controller.value, range = draft.value?.getRange();
    if (!owner || !range) { cancelDraft(); return; }
    const result = owner.add({ body, mentions: mentions.map(({ id, label, url }) => ({ id, label, url })) }, range);
    // The thread takes over the draft's measured position, so its card renders in place before the next measurement.
    const placed = anchors.value.get("draft");
    if (result.ok && placed !== undefined) anchors.value = new Map([...anchors.value].filter(([id]) => id !== "draft")).set(result.id, placed);
    cancelDraft();
    if (result.ok) owner.activate(result.id);
  }

  /**
   * @param id - Thread to focus; its text is selected, and scrolled into view when the card is not beside it.
   * @param scroll - Always scroll, as navigation does.
   */
  function activate(id: string, scroll = false): void {
    const editor = input.editor(), owner = controller.value, range = views.value.find(view => view.thread.id === id)?.range;
    if (!editor || !owner) return;
    owner.activate(id);
    if (!range) return;
    editor.setSelection(EditorSelection.single(range.from));
    if (scroll || layout.value !== "side") editor.scrollTo(range.from);
  }

  /**
   * Moves to the neighbouring unresolved thread in source order, wrapping at either end.
   * @param direction - 1 for next, -1 for previous.
   * @returns Whether a thread was focused.
   */
  function step(direction: 1 | -1): boolean {
    const editor = input.editor(), ordered = sequence.value;
    if (!editor || !ordered.length) return false;
    const current = ordered.findIndex(item => item.id === active.value), head = editor.state.selection.main.head;
    const after = ordered.findIndex(item => item.from > head), before = (after < 0 ? ordered.length : after) - 1;
    const index = current >= 0 ? (current + direction + ordered.length) % ordered.length
      : direction > 0 ? Math.max(0, after) : (before + ordered.length) % ordered.length;
    activate(ordered[index]!.id, true);
    return true;
  }

  /** @returns Whether a draft for a comment on the whole document opened. */
  function openDocumentDraft(): boolean {
    if (!controller.value?.writable()) return false;
    documentDraft.value = true;
    if (!input.documentSection?.()) panelOpen.value = true;
    return true;
  }

  /** Abandons the document comment draft. */
  function cancelDocumentDraft(): void { documentDraft.value = false; }

  /** @param body - Root message. @param mentions - People mentioned in it. Creates a comment on the whole document. */
  function submitDocumentDraft(body: string, mentions: readonly CommentMention[] = []): void {
    const owner = controller.value;
    if (!owner) return;
    const result = owner.addDocument({ body, mentions: mentions.map(({ id, label, url }) => ({ id, label, url })) });
    documentDraft.value = false;
    if (result.ok) owner.activate(result.id);
  }

  /** @param id - Thread. @returns Its place among the unresolved threads a reader steps through, if it is one of them. */
  function positionOf(id: string): QuireKitCommentPosition | undefined {
    const index = sequence.value.findIndex(item => item.id === id);
    return index < 0 ? undefined : { index: index + 1, total: sequence.value.length };
  }

  /** Resolves a thread and moves on to the next unresolved one, so threads can be worked through in order. @param id - Thread. */
  function resolve(id: string): void {
    const owner = controller.value, ordered = sequence.value, index = ordered.findIndex(item => item.id === id);
    const next = index >= 0 && ordered.length > 1 ? ordered[(index + 1) % ordered.length]!.id : null;
    if (owner?.resolve(id).ok && next) activate(next, true);
  }

  // Pressing outside the focused thread's card clears focus. Presses in the document are left to the selection, which
  // focuses the thread under the caret; toolbars and overlays (menus, dialogs) act on the focused thread themselves.
  watch([active, input.editor] as const, ([id, editor], _previous, cleanup) => {
    const doc = editor?.element.ownerDocument;
    if (!id || !editor || !doc) return;
    /** @param event - Any press in the page. */
    const press = (event: PointerEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest("[data-md-comment]")?.getAttribute("data-md-comment") === id || editor.element.contains(target)
        || target.closest('[role="toolbar"], [role="menu"], [role="listbox"], [role="dialog"]')) return;
      controller.value?.activate(null);
    };
    doc.addEventListener("pointerdown", press, true);
    cleanup(() => doc.removeEventListener("pointerdown", press, true));
  });

  onBeforeUnmount(() => { cancelDraft(); if (frame) input.editor()?.element.ownerDocument.defaultView?.cancelAnimationFrame(frame); });
  return { controller, cards, railCards, railItems, active, layout, draft, draftQuote, panelOpen, rail, openDraft, cancelDraft, submitDraft, activate, step, positionOf, resolve,
    documentCards, documentDraft, openDocumentDraft, cancelDocumentDraft, submitDocumentDraft };
}
