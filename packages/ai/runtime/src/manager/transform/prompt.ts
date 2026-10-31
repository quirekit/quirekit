import type { QuireAiSegment } from "./types";

/**
 * Builds the system prompt of one transform.
 *
 * The protocol comes first and the task last, and both stay the same for every
 * call, so a provider's prefix cache serves all calls after the first.
 *
 * @param instruction - Task applied to every segment.
 * @returns System prompt.
 */
export function createQuireAiTransformSystemPrompt(instruction: string): string {
  return [
    "You apply one task to numbered text segments of a document.",
    "",
    "Each input line is `[N] text`. Answer with one line `[N] new text` for every segment, and nothing else.",
    "- `<t1>…</t1>` marks words with their own formatting: put the corresponding new words between the same pair of tags.",
    "- `<x1/>` marks an embedded object and `<br/>` a line break: keep each one where it belongs.",
    "- Keep one answer line per segment: do not merge, split, skip or add segments. Repeat a segment unchanged when the task leaves it as it is.",
    "- Keep each segment in its own language unless the task asks for a translation, whatever language the task is written in.",
    "- Write only the resulting text: no explanations, notes, quotes or markdown.",
    "",
    "Task:",
    instruction
  ].join("\n");
}

/**
 * @param segments - Segments of one call.
 * @returns User message listing them.
 */
export function createQuireAiTransformPrompt(segments: readonly QuireAiSegment[]): string {
  return segments.map(segment => `[${segment.number}] ${segment.text}`).join("\n");
}
