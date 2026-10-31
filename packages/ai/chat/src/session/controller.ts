import { createAiChatModelOptions, resolveAiChatSelectedModel } from "../model-selection";
import type { AiChatController, AiChatSnapshot, AiChatWorkspaceOptions } from "../types";
import { acceptDocumentEvent, createChatId, publish } from "./state";
import { submitChatTurn } from "./turn";
import type { ChatState } from "./types";

/** Create a conversation independently of a framework, sidebar or current viewport.
 * @param options - Application-owned document and harness ports.
 * @returns Retained headless controller.
 */
export function createAiChatController(options: AiChatWorkspaceOptions): AiChatController {
  const models = createAiChatModelOptions(options.primaryModel, options.availableModels);
  const state: ChatState = {
    destroyed: false, active: undefined, listeners: new Set(),
    snapshot: Object.freeze({ conversationId: createChatId("conversation"), draft: "", messages: [], models,
      selectedModelId: options.primaryModel.id, authorizationMode: options.defaultAuthorizationMode ?? "request-approval",
      pending: false, reviews: [], documentEvents: [], operationMessageIds: {}, ...restored(options.restore) })
  };
  const unsubscribe = options.document.subscribe(event => acceptDocumentEvent(state, event));
  let preferenceRevision = 0;
  let resetting: Promise<void> | undefined;
  let destruction: Promise<void> | undefined;
  void restorePreferences();
  const controller: AiChatController = {
    options,
    getSnapshot: () => state.snapshot,
    subscribe(listener) { state.listeners.add(listener); return () => { state.listeners.delete(listener); }; },
    setDraft(text) { publish(state, { draft: text }); },
    selectModel(id) {
      if (state.snapshot.pending || state.destroyed) return;
      preferenceRevision += 1;
      const selectedModelId = resolveAiChatSelectedModel(models, id).id;
      publish(state, { selectedModelId });
      void Promise.resolve().then(() => options.modelSelectionStore?.saveSelectedModelId(selectedModelId)).catch(() => undefined);
    },
    selectAuthorizationMode(mode) {
      if (state.snapshot.pending || state.destroyed) return;
      preferenceRevision += 1;
      publish(state, { authorizationMode: mode });
      void Promise.resolve().then(() => options.authorizationModeStore?.saveAuthorizationMode(mode)).catch(() => undefined);
    },
    submit() { preferenceRevision += 1; return resetting === undefined ? submitChatTurn(state, options) : Promise.resolve(); },
    stop() { state.active?.controller.abort(); },
    decidePreview(id, decision) { return options.document.decidePreview(id, decision); },
    reset() {
      if (state.destroyed) return Promise.resolve();
      if (resetting !== undefined) return resetting;
      preferenceRevision += 1;
      controller.stop();
      resetting = (async () => {
        await state.active?.settled;
        if (state.destroyed) return;
        publish(state, { pending: true });
        try {
          await options.responder.reset();
          publish(state, { conversationId: createChatId("conversation"), messages: [], reviews: [], documentEvents: [], operationMessageIds: {}, errorCode: undefined });
        } catch { publish(state, { errorCode: "session-failed" }); }
        finally { publish(state, { pending: false }); }
      })().finally(() => { resetting = undefined; });
      return resetting;
    },
    destroy() {
      if (destruction !== undefined) return destruction;
      controller.stop();
      unsubscribe();
      options.document.destroy();
      state.destroyed = true;
      state.listeners.clear();
      destruction = Promise.resolve().then(() => options.responder.destroy()).then(() => state.active?.settled).then(() => undefined);
      return destruction;
    }
  };
  return controller;

  /** Restore preferences without overriding a newer user selection or active turn. */
  async function restorePreferences(): Promise<void> {
    const revision = preferenceRevision;
    const [model, authorization] = await Promise.allSettled([
      Promise.resolve().then(() => options.modelSelectionStore?.loadSelectedModelId()),
      Promise.resolve().then(() => options.authorizationModeStore?.loadAuthorizationMode())
    ]);
    if (state.destroyed || state.snapshot.pending || preferenceRevision !== revision) return;
    publish(state, {
      selectedModelId: model.status === "fulfilled" ? resolveAiChatSelectedModel(models, model.value).id : options.primaryModel.id,
      authorizationMode: authorization.status === "fulfilled" && authorization.value !== undefined
        ? authorization.value : options.defaultAuthorizationMode ?? "request-approval"
    });
  }
}

/** @param restore - Earlier displayed conversation. @returns Snapshot fields that settle what the earlier SDK left open. */
function restored(restore: AiChatWorkspaceOptions["restore"]): Partial<AiChatSnapshot> {
  if (restore === undefined) return {};
  return {
    ...restore,
    messages: restore.messages.map(message => message.pending || message.status === "pending" || message.status === "streaming"
      ? { ...message, pending: false, status: "stopped" as const } : message),
    reviews: restore.reviews.map(review => review.state === "pending" ? { ...review, state: "expired" as const } : review)
  };
}
