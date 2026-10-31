import type { QuireDocumentSdk } from "@quirekit/ai-runtime";

/**
 * Places today's date, the reply language and the request's document context before the user's
 * words. The date stays out of the system instructions so their cached prefix does not change daily.
 * @param document - Document SDK of the request.
 * @param requestId - Captured request identity.
 * @param prompt - User's request.
 * @param now - Current time, in the user's time zone.
 * @returns Prompt sent to the model.
 */
export function composeQuireAiPrompt(document: QuireDocumentSdk, requestId: string, prompt: string, now = new Date()): string {
  const context = document.describeRequest?.(requestId);
  const pad = (value: number) => String(value).padStart(2, "0");
  // Restating the reply language beside the request keeps short progress notes in it too.
  const language = /\p{Script=Han}/u.test(prompt) ? "<language>所有给用户看的文字都用中文，包括工具调用之间的简短说明。</language>" : "";
  const today = `<today>${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${"日一二三四五六".split("").map(day => `星期${day}`)[now.getDay()]}</today>`;
  const head = language === "" ? today : `${today}\n${language}`;
  return context === undefined ? `${head}\n${prompt}` : `${head}\n${context}\n<request>\n${prompt}\n</request>`;
}
