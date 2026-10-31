import { createQuireAiTransformTool } from "./transform/tool";
import type { QuireAiTransformRun } from "./transform/types";
import { createQuireAiEditOperation } from "./edit/schema";
import type { QuireEditor } from "@quirekit/core";
import { createQuireDocumentSdk } from "../document-sdk";
import { createQuireAiBlockIdentity } from "./identity";
import { describeQuireAiRequest } from "./context";
import { createQuireAiEditTool } from "./edit/tool";
import { createQuireAiPreviewChannel } from "./previews";
import { createQuireAiSkillTool } from "../skills/tool";
import { registerQuireAiHostPorts } from "./edit/prepare";
import { createQuireAiHelpTool } from "./help-tool";
import { createQuireAiReadTool } from "./read-tool";
import { describeQuireAiDocument } from "./view/render";
import { describeQuireAiChanges } from "./view/changes";
import { describeQuireAiBlockReferences } from "./view/references";
import { createQuireAiCommandActions } from "./edit/command-actions";
import { compileQuireAiRegistry } from "./registry";
import type { QuireAiManager, QuireAiRegistry } from "./types";

const managers = new WeakMap<QuireEditor, QuireAiManager>();

/**
 * Returns the AI manager of an editor, creating it on first use.
 *
 * The manager is released when the editor is destroyed.
 *
 * @param editor - Editor instance.
 * @returns Per-editor AI manager.
 */
export function getQuireAi(editor: QuireEditor): QuireAiManager {
  const existing = managers.get(editor);
  if (existing !== undefined) return existing;
  let registry: QuireAiRegistry | undefined;
  const identity = createQuireAiBlockIdentity(editor);
  const channel = createQuireAiPreviewChannel(editor);
  const manager: QuireAiManager = {
    editor,
    get registry() {
      return registry ??= compileQuireAiRegistry(editor.extensionManager.extensions, createQuireAiCommandActions(editor));
    },
    identity,
    previews: channel.previews,
    createDocumentSdk(options) {
      const { tools, transform, skills, pictures, layout, ...rest } = options;
      const transformRuns = new Map<string, QuireAiTransformRun>();
      const sdk = createQuireDocumentSdk({
        describeDocument: doc => describeQuireAiDocument(doc, manager.registry),
        describeChanges: (source, candidate) => describeQuireAiChanges(source, candidate, manager.registry),
        presentReply: (text, language) => describeQuireAiBlockReferences(text, editor.state.doc, manager.registry, identity, language),
        ...rest,
        editor,
        tools: host => (registerQuireAiHostPorts(host, { pictures, layout }), [
          createQuireAiReadTool(manager, host, layout), createQuireAiEditTool(manager, host, channel),
          createQuireAiHelpTool(manager, createQuireAiEditOperation(manager.registry), pictures),
          // Without an enabled skill the tool would only cost tokens.
          ...(skills === undefined || skills.enabledEntries().length === 0 ? [] : [createQuireAiSkillTool(skills)]),
          ...(transform === undefined ? [] : [createQuireAiTransformTool(manager, host, createQuireAiEditOperation(manager.registry), transform, transformRuns)]),
          ...(tools?.(host) ?? [])
        ])
      });
      // A call that fails validation or settles without reaching its tool still owns a streamed preview.
      const unsubscribe = sdk.subscribe(event => {
        if (event.type === "operation" && event.operation.status !== "running") channel.clear(event.operation.id);
        if (event.type === "preview") {
          const id = event.preview.id;
          channel.attachReview(event.preview.operationId, {
            approve: () => sdk.decidePreview(id, "approved"),
            reject: () => sdk.decidePreview(id, "rejected")
          });
        }
      });
      // Context is captured with the request so it matches the selection the user acted on.
      const contexts = new Map<string, string>();
      return Object.freeze({
        ...sdk,
        captureRequest() {
          const request = sdk.captureRequest();
          contexts.set(request.id, describeQuireAiRequest(editor, manager.registry, identity));
          return request;
        },
        releaseRequest(requestId: string) {
          contexts.delete(requestId);
          channel.clearAll();
          sdk.releaseRequest(requestId);
        },
        describeRequest: (requestId: string) => contexts.get(requestId),
        destroy() {
          contexts.clear();
          unsubscribe();
          channel.clearAll();
          sdk.destroy();
        }
      });
    }
  };
  managers.set(editor, manager);
  editor.on("destroy", () => {
    identity.destroy();
    channel.destroy();
    managers.delete(editor);
  });
  return manager;
}
