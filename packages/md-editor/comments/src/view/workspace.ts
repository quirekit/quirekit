import { computed, defineComponent, h } from "vue";
import type { MdCommentsSetupInput, MdCommentsWorkspace } from "@quirekit/md-editor/vue";
import type { QuireKitCommentMention } from "@quirekit/ui/vue";
import { mdCommentsMessages } from "../messages";
import type { MdCommentsOptions } from "../types";
import { commentAuthor } from "./model";
import { useMdComments } from "./use-comments";
import CommentDocument from "./document.vue";
import CommentList from "./list.vue";
import CommentSide from "./side.vue";

/**
 * Builds one editor's workspace: presentation state from `useMdComments` and the three components `MdEditor` places.
 * Must run during component setup, because `useMdComments` registers watchers and unmount cleanup.
 * @param options - Host comment configuration.
 * @param input - Reactive inputs from `MdEditor`.
 * @returns Workspace driven by `MdEditor`.
 */
export function createMdCommentsWorkspace(options: MdCommentsOptions, input: MdCommentsSetupInput): MdCommentsWorkspace {
  const text = computed(() => mdCommentsMessages[input.locale()]);
  // Comments on the whole document get a section after the document only when the host asks for it.
  const sectioned = options.documentComments === "end";
  const comments = useMdComments({ editor: input.editor, state: input.state, options: () => options, root: input.root, wide: input.wide,
    documentLabel: () => text.value.documentCommentQuote, documentSection: () => sectioned });
  const author = computed(() => options.user ? commentAuthor(options.user, options) : undefined);
  /** @param body - Root message. @param people - Mentioned people. */
  const submit = (body: string, people: readonly QuireKitCommentMention[]): void => comments.submitDraft(body, people);
  /** @param body - Root message. @param people - Mentioned people. */
  const submitDocument = (body: string, people: readonly QuireKitCommentMention[]): void => comments.submitDocumentDraft(body, people);

  const rail = defineComponent({ name: "MdCommentRail", setup: () => () => {
    const controller = comments.controller.value;
    return controller ? h(CommentSide, { items: comments.railItems.value, cards: comments.railCards.value, active: comments.active.value, controller,
      author: author.value, draftQuote: comments.draftQuote.value, mentions: input.mentions(), positionOf: comments.positionOf,
      onRail: (element: HTMLElement | null) => { comments.rail.value = element; }, onActivate: comments.activate, onStep: comments.step,
      onResolve: comments.resolve, onSubmit: submit, onCancel: comments.cancelDraft }) : null;
  } });

  const list = defineComponent({ name: "MdCommentList", setup: () => () => {
    const controller = comments.controller.value, labels = text.value;
    return controller ? h(CommentList, { open: comments.panelOpen.value, "onUpdate:open": (open: boolean) => { comments.panelOpen.value = open; },
      cards: comments.cards.value, active: comments.active.value, controller, author: author.value,
      drafting: !!comments.draft.value && comments.layout.value !== "side", draftQuote: comments.draftQuote.value, narrow: input.narrow(),
      labels: { title: labels.comments, empty: labels.noComments, orphaned: labels.orphanedComments, resolved: labels.resolvedComments, document: labels.documentComments },
      mentions: input.mentions(), positionOf: comments.positionOf, documentDrafting: comments.documentDraft.value && !sectioned,
      documentAdd: author.value ? labels.addDocumentComment : undefined, onActivate: comments.activate, onStep: comments.step, onResolve: comments.resolve,
      onAddDocument: comments.openDocumentDraft, onSubmitDocument: submitDocument, onCancelDocument: comments.cancelDocumentDraft,
      onSubmit: submit, onCancel: comments.cancelDraft }) : null;
  } });

  const documentSection = defineComponent({ name: "MdDocumentComments", setup: () => () => {
    const controller = comments.controller.value;
    return controller ? h(CommentDocument, { cards: comments.documentCards.value, active: comments.active.value, controller,
      drafting: comments.documentDraft.value, author: author.value, mentions: input.mentions(),
      labels: { title: text.value.documentComments, placeholder: text.value.documentCommentPlaceholder },
      onActivate: comments.activate, onSubmit: submitDocument, onFocused: comments.cancelDocumentDraft, onResolve: comments.resolve }) : null;
  } });

  return {
    layout: comments.layout,
    // Write permission can follow the source's read-only state, so it is re-read with every accepted state.
    writable: computed(() => { void input.state(); return !!comments.controller.value?.writable(); }),
    drafting: computed(() => !!comments.draft.value),
    openDraft: comments.openDraft, openDocumentDraft: comments.openDocumentDraft, step: comments.step,
    showList: () => { comments.panelOpen.value = true; },
    documentSection: sectioned ? documentSection : null, rail, list,
  };
}
