import { createAiChatController, mountAiChatWorkspace, type AiChatController, type AiChatWorkspaceMount } from "@quirekit/ai-chat";
import {
  createQuireAiAuthorizationModeStore, createQuireAiDisconnectedResponder, createQuireAiModelSelectionStore, createQuireAiPiResponder,
  type QuireAiModelConnection, type QuireAiProviderSettingsHandle
} from "@quirekit/ai-assistant";
import type { MdEditorPanelContext, MdEditorPanelMount } from "@quirekit/md-editor/vue";
import { createMsfeDocumentSdk } from "@quirekit/msfe-ai";
import { defaultTheme } from "@quirekit/ui";
import { v4 as uuidv4 } from "uuid";
import { createMdEditorAiPorts } from "./ports";
import type { MdEditorAiOptions } from "./types";

/** Model turns one request may take: reading, edits with figures that may need a corrected retry, and comment replies. */
const modelTurns = 24;

/**
 * Mounts the assistant beside one editor: a document SDK on the editor, a conversation and its
 * workspace. The model connection resolves on first open, so nothing is contacted before that.
 * @param context - Editor and frame controls from MD Editor.
 * @param options - Host configuration.
 * @param settings - Provider settings shared by the page.
 * @param connection - Model connection, resolved once per page.
 * @returns Panel content and its lifecycle.
 */
export function mountMdEditorAiPanel(context: MdEditorPanelContext, options: MdEditorAiOptions, settings: QuireAiProviderSettingsHandle | undefined,
  connection: () => Promise<QuireAiModelConnection>): MdEditorPanelMount {
  const element = context.ownerDocument.createElement("div");
  element.className = "md-editor-ai";
  element.style.cssText = "display:flex;flex-direction:column;min-height:0;height:100%";
  let locale = context.locale;
  let controller: AiChatController | undefined;
  let workspace: AiChatWorkspaceMount | undefined;
  let destroyed = false;
  const document = createMsfeDocumentSdk(context.editor, {
    documentId: `md-document-${uuidv4()}`,
    ...(options.agent === undefined ? {} : { agent: options.agent }),
    ports: createMdEditorAiPorts(context.ownerDocument, options.images),
    // The authorization preset is read again at every write: approval reviews each request at its end.
    authorizeWrite: () => ({ allowed: true, review: controller?.getSnapshot().authorizationMode !== "full-access" })
  });
  void connection().then(models => {
    if (destroyed) return;
    controller = createAiChatController({
      document,
      responder: models.resolveAgentRuntime === undefined ? createQuireAiDisconnectedResponder()
        : createQuireAiPiResponder(models.resolveAgentRuntime, { systemPrompt: document.instructions(), maxModelTurns: modelTurns }),
      primaryModel: models.primaryModel,
      ...(models.availableModels === undefined ? {} : { availableModels: models.availableModels }),
      providerStatus: models.providerStatus,
      ...(settings ? { providerSettings: { open: () => settings.open() } } : {}),
      modelSelectionStore: createQuireAiModelSelectionStore(options.storage),
      authorizationModeStore: createQuireAiAuthorizationModeStore(options.storage),
      defaultAuthorizationMode: "request-approval",
      ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
      locateChange: (_review, change) => {
        const range = change.candidate ?? change.source;
        if (range !== undefined) context.reveal(range);
      }
    });
    workspace = mountAiChatWorkspace({ ownerDocument: context.ownerDocument, controller, theme: defaultTheme, locale, onClose: () => context.close() });
    element.append(workspace.element);
  });
  return {
    element,
    update(state) {
      locale = state.locale;
      workspace?.update({ theme: defaultTheme, locale, onClose: () => context.close() });
    },
    destroy() {
      destroyed = true;
      workspace?.destroy();
      void controller?.destroy().catch(() => undefined);
      document.destroy();
      element.remove();
    }
  };
}
