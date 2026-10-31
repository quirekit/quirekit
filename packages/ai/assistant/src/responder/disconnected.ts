import type { AiChatModelDescriptor, AiChatResponder } from "@quirekit/ai-chat";

/** Honest descriptor shown before a model provider is configured. */
export const quireAiDisconnectedModel: AiChatModelDescriptor = Object.freeze({
  id: "disconnected-model",
  label: "Configure a model",
  provider: "QuireKit",
  capabilities: { vision: false, files: false, reasoning: false }
});

/** @returns Non-generating responder with setup guidance. */
export function createQuireAiDisconnectedResponder(): AiChatResponder {
  return {
    async respond(request) {
      request.signal.throwIfAborted();
      return { content: "尚未连接大模型。请打开右上角 AI 设置，配置浏览器直连或 Provider Host。" };
    },
    reset() {},
    destroy() {}
  };
}
