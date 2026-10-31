import type {
  AssistantMessage,
  ToolResultMessage
} from "@earendil-works/pi-ai";
/**
 * Reads the latest visible assistant or terminal native Tool text.
 *
 * @param messages - Complete Pi transcript.
 * @param fromIndex - First run-owned message index after committed history.
 * @returns Latest current-run visible text.
 */
export function readFinalAssistantText(
  messages: readonly unknown[],
  fromIndex: number
): string {
  for (let index = messages.length - 1; index >= fromIndex; index -= 1) {
    const message = messages[index] as Partial<
      AssistantMessage | ToolResultMessage
    > | undefined;
    if ((message?.role !== "assistant" && message?.role !== "toolResult")
      || !Array.isArray(message.content)) continue;
    const content = message.content
      .filter(block => block.type === "text")
      .map(block => block.type === "text" ? block.text : "")
      .join("")
      .trim();
    if (content.length > 0) return content;
  }
  return "";
}

/**
 * Reads one Pi assistant error message.
 *
 * @param value - Candidate transcript or turn-end message.
 * @returns Provider failure text, or undefined for a successful turn.
 */
export function readAssistantErrorMessage(value: unknown): string | undefined {
  const candidate = value as Partial<AssistantMessage> | undefined;
  return candidate?.role === "assistant"
    && typeof candidate.errorMessage === "string"
    && candidate.errorMessage.length > 0
    ? candidate.errorMessage
    : undefined;
}
