import type { QuireAiSourceSnapshot, QuireAiSourceView, QuireAiSourceViewAnnotation, QuireAiSourceViewBlock } from "./types";

/** Lines of a long code block or table shown at each end. */
const shownEdgeLines = 20;

/** Lines beyond which a block's middle is left out of a listing. */
const longBlockLines = 80;

/** Characters of a listing beyond which the listing stops and offers `next`. */
const listingCharacterLimit = 24_000;

/** Options of one rendered window. */
export interface QuireAiSourceRenderOptions {
  /** Block to start at. */
  readonly from?: string | undefined;
  /** Maximum blocks. */
  readonly limit: number;
  /** List only blocks whose source holds this exact text. */
  readonly find?: string | undefined;
  /** Start three blocks before the first block reaching this position. */
  readonly around?: number | undefined;
  /** List one block in full, without leaving out the middle of a long block. */
  readonly full?: boolean | undefined;
}

/**
 * Renders a window of the source view.
 * @param snapshot - Current snapshot.
 * @param options - Window.
 * @returns View text and paging facts.
 * @throws RangeError when `from` names no current block.
 */
export function renderQuireAiSourceView(snapshot: QuireAiSourceSnapshot, options: QuireAiSourceRenderOptions): QuireAiSourceView {
  const { find } = options;
  const candidates = find === undefined ? snapshot.blocks : snapshot.blocks.filter(block => block.text.includes(find));
  let start = 0;
  if (options.from !== undefined) {
    start = candidates.findIndex(block => block.id === options.from);
    if (start < 0) throw new RangeError(`Unknown block ${options.from}.`);
  } else if (options.around !== undefined) {
    const reached = candidates.findIndex(block => block.end >= options.around!);
    start = Math.max(0, (reached < 0 ? candidates.length : reached) - 3);
  }
  const lines: string[] = [start === 0 ? "## 正文" : "## 正文（续）"];
  let length = 0;
  let index = start;
  for (; index < candidates.length && index - start < options.limit; index += 1) {
    const line = renderBlock(candidates[index]!, options.full === true);
    // A listing always shows at least one block, whatever its length.
    if (index > start && length + line.length > listingCharacterLimit) break;
    lines.push(line);
    length += line.length + 1;
  }
  const next = candidates[index]?.id;
  if (next === undefined && find === undefined && snapshot.annotations.length > 0) lines.push(...renderAnnotations(snapshot.annotations));
  const occurrences = find === undefined ? 0 : candidates.reduce((sum, block) => sum + count(block.text, find), 0);
  return { text: lines.join("\n"), listed: index - start, total: candidates.length, next, occurrences };
}

/**
 * @param block - View block.
 * @param full - Whether to keep the middle of a long block.
 * @returns The block's listing: id, source or summary, and attached annotations.
 */
export function renderBlock(block: QuireAiSourceViewBlock, full: boolean): string {
  const lead = `${"  ".repeat(block.depth)}[${block.id}] `;
  // Inline image data reads as noise to the model; its length is kept so the image is still recognizable.
  const text = block.text.replace(/data:([\w/+.-]+);base64,[A-Za-z0-9+/=]{200,}/gu, (match, type: string) => `data:${type};base64,…(${Math.round(match.length / 1024)} KB)`);
  const notes = block.annotations.length === 0 ? "" : `  ⟨批注 ${block.annotations.join(", ")}⟩`;
  if (block.summary !== undefined) return `${lead}${block.summary.label}${notes}`;
  const lines = text.split("\n");
  if (!full && lines.length > longBlockLines) {
    const omitted = lines.length - shownEdgeLines * 2;
    const shown = [...lines.slice(0, shownEdgeLines), `…（省略中间 ${omitted} 行；document_read 的 block 参数可读取全文）`, ...lines.slice(-shownEdgeLines)];
    return `${lead}${shown.join("\n")}${notes}`;
  }
  return `${lead}${text}${notes}`;
}

/**
 * @param annotations - Annotations in document order.
 * @returns Section lines listing each thread with its messages.
 */
function renderAnnotations(annotations: readonly QuireAiSourceViewAnnotation[]): string[] {
  const lines: string[] = [];
  let label = "";
  for (const item of annotations) {
    if (item.label !== label) lines.push(`## ${label = item.label}`);
    const { annotation } = item;
    const status = annotation.status === "resolved" ? "已解决" : annotation.status === "detached" ? "原文已找不到" : "未解决";
    const where = item.block === null ? "" : `于 ${item.block}`;
    lines.push(`[${item.id}] ${where}“${clip(annotation.quote, 40)}”，${status}`);
    for (const message of annotation.messages) lines.push(`  ${message.author}${message.agent ? "（AI）" : ""}：${message.body}`);
  }
  return lines;
}

/** @param text - Text. @param limit - Characters kept. @returns Text, clipped with an ellipsis. */
function clip(text: string, limit: number): string {
  const single = text.replace(/\s+/gu, " ");
  return single.length > limit ? `${single.slice(0, limit)}…` : single;
}

/** @param text - Text searched. @param find - Non-empty text. @returns Non-overlapping occurrences. */
export function count(text: string, find: string): number {
  let total = 0;
  for (let at = text.indexOf(find); at >= 0; at = text.indexOf(find, at + find.length)) total += 1;
  return total;
}
