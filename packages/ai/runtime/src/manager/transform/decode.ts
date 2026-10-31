import type { QuireAiSegment, QuireAiSegmentAnswer } from "./types";

/** An answer line: `[N] text`, tolerating a leading list marker. */
const answerLine = /^\s*(?:[-*•]\s+)?\[(\d+)\]\s?(.*)$/u;

/** Tags the protocol defines. */
const tagPattern = /<(\/?)t(\d+)>|<x(\d+)\/>|<br\/>/gu;

/**
 * Reads the answer lines of one call.
 *
 * Lines not starting with a segment number are ignored, so remarks never become
 * content; a number given twice keeps its first line.
 *
 * @param answer - Model answer.
 * @param segments - Segments of the call, by number.
 * @returns Checked answer for every segment of the call.
 */
export function decodeQuireAiSegments(
  answer: string,
  segments: ReadonlyMap<number, QuireAiSegment>
): Map<number, QuireAiSegmentAnswer> {
  const lines = new Map<number, string>();
  for (const line of answer.split(/\r?\n/u)) {
    const match = answerLine.exec(line);
    if (match === null) continue;
    const number = Number(match[1]);
    if (segments.has(number) && !lines.has(number)) lines.set(number, match[2]!.trim());
  }
  const answers = new Map<number, QuireAiSegmentAnswer>();
  for (const [number, segment] of segments) {
    const text = lines.get(number);
    answers.set(number, text === undefined ? { status: "missing", reason: "the model gave no answer for it" } : checkSegmentAnswer(segment, text));
  }
  return answers;
}

/**
 * Checks one answer against its segment's tags.
 *
 * Tags must open and close in pairs without nesting and name tags of the
 * segment; otherwise the tags are dropped and the text kept. Object placeholders
 * must all survive, since writing the block would otherwise lose the objects.
 *
 * @param segment - Source segment.
 * @param text - Answer text.
 * @returns Checked answer.
 */
export function checkSegmentAnswer(segment: QuireAiSegment, text: string): QuireAiSegmentAnswer {
  if (stripTags(text).trim() === "") return { status: "missing", reason: "the answer was empty" };
  const objects = new Set<number>();
  let open: number | null = null;
  let valid = true;
  for (const match of text.matchAll(tagPattern)) {
    const [, closing, tag, object] = match;
    if (object !== undefined) {
      objects.add(Number(object));
    } else if (tag !== undefined) {
      const number = Number(tag);
      if (!segment.tags.has(number)) valid = false;
      else if (closing === "") { if (open !== null) valid = false; open = number; }
      else if (open !== number) valid = false;
      else open = null;
    }
  }
  if (open !== null) valid = false;
  if (objects.size < segment.objects) return { status: "missing", reason: "the answer dropped an embedded object" };
  return valid ? { status: "ok", text } : { status: "degraded", text: stripTags(text, true) };
}

/**
 * @param text - Answer text.
 * @param keepTokens - Whether to keep object and line-break tokens.
 * @returns Text without formatting tags.
 */
function stripTags(text: string, keepTokens = false): string {
  return text.replace(tagPattern, (token, _closing, tag) => tag !== undefined || !keepTokens ? "" : token);
}
