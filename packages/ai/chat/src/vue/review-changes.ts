import type { QuireDocumentFormatChange, QuireDocumentTextPiece } from "@quirekit/ai-runtime";

/** Kept text longer than this is shortened around the change. */
const keptLength = 24;

/** Format change text longer than this is shortened. */
const coveredLength = 24;

/**
 * Writes one format change as a short phrase, such as "取消加粗 · 方式。" or "对齐：居中 → 左对齐".
 * @param change - Format change.
 * @param locale - Product language.
 * @returns Phrase for people.
 */
export function describeFormatChange(change: QuireDocumentFormatChange, locale: "zh-CN" | "en"): string {
  const zh = locale === "zh-CN";
  let phrase: string;
  if (change.toggle) phrase = change.after !== null ? change.label : zh ? `取消${change.label}` : `Remove ${change.label}`;
  else if (change.before === null) phrase = `${change.label}${zh ? "：" : ": "}${change.after}`;
  else if (change.after === null) phrase = zh ? `取消${change.label}（原为${change.before}）` : `Remove ${change.label} (was ${change.before})`;
  else phrase = `${change.label}${zh ? "：" : ": "}${change.before} → ${change.after}`;
  return change.text === undefined ? phrase : `${phrase} · ${shorten(change.text, coveredLength)}`;
}

/**
 * Shortens long kept text so a rewritten block shows its change with a little context.
 * @param pieces - Text pieces of one block.
 * @returns Pieces whose kept text keeps only the characters next to a change.
 */
export function trimKeptText(pieces: readonly QuireDocumentTextPiece[]): QuireDocumentTextPiece[] {
  const side = keptLength / 2;
  return pieces.map((piece, index) => {
    const chars = [...piece.text];
    if (piece.kind !== "same" || chars.length <= keptLength) return piece;
    const first = index === 0;
    const last = index === pieces.length - 1;
    if (first && last) return piece;
    if (first) return { kind: "same", text: `…${chars.slice(-side).join("")}` };
    if (last) return { kind: "same", text: `${chars.slice(0, side).join("")}…` };
    return { kind: "same", text: `${chars.slice(0, side / 2).join("")}…${chars.slice(-side / 2).join("")}` };
  });
}

/**
 * @param text - Text to shorten.
 * @param length - Maximum characters.
 * @returns The text, or its start followed by an ellipsis.
 */
function shorten(text: string, length: number): string {
  const chars = [...text];
  return chars.length > length ? `${chars.slice(0, length).join("")}…` : text;
}
