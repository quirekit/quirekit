import type { QuireAiAnnotation, QuireAiSourceCapability } from "@quirekit/ai-contract";
import type { CommentsController } from "../controller/controller";

/**
 * Describes comment threads to the AI core as annotations attached to source ranges.
 * @param controller - Current comment controller, absent before the editor mounts.
 * @returns Facts for `addAiCapabilities`.
 */
export function createCommentsAiFacts(controller: () => CommentsController | undefined): readonly QuireAiSourceCapability[] {
  return [{
    kind: "annotation",
    label: "批注",
    read: () => (controller()?.threads() ?? []).map((view): QuireAiAnnotation => ({
      id: view.thread.id,
      range: view.range,
      // A document comment has no quoted text and is open until resolved.
      quote: view.thread.anchor?.quote.exact ?? "",
      status: view.thread.resolved ? "resolved" : view.status === "placed" || view.status === "document" ? "open" : "detached",
      messages: view.thread.messages.map(message => ({
        author: message.author.name, agent: message.author.agent === true, createdAt: message.createdAt, body: message.body
      }))
    }))
  }];
}
