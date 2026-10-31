/** Failures and skipped blocks listed in full; longer lists are counted. */
const listedLimit = 20;

/** Written results quoted in the report. */
const sampleLimit = 3;

/** Running totals of one transform. */
export interface QuireAiTransformReport {
  /** Blocks the transform covers. */
  readonly total: number;
  /** Blocks an interrupted earlier run already finished, skipped by this one. */
  readonly resumed: number;
  /** Blocks whose answer has been handled. */
  done: number;
  /** Blocks written. */
  transformed: number;
  /** Written blocks whose formatting fell back to the shared formats. */
  degraded: number;
  /** Blocks not written, with the reason. */
  readonly failures: { readonly block: string; readonly reason: string }[];
  /** Blocks in scope left as they are, with the reason. */
  readonly skipped: { readonly block: string; readonly reason: string }[];
  /** Written results with their segment number and source, in the order they were written. */
  readonly samples: { readonly number: number; readonly source: string; readonly result: string }[];
  /** Token usage summed over calls. */
  readonly usage: { input: number; output: number; cacheRead: number };
}

/**
 * Writes the model-visible result of a transform.
 *
 * It states coverage and, when everything was written, that the task is
 * complete, so the planner reports instead of re-reading the document.
 *
 * @param report - Final totals.
 * @param texts - Plain text of each block, for naming failures.
 * @returns Summary.
 */
export function describeQuireAiTransform(report: QuireAiTransformReport, texts: ReadonlyMap<string, string>): string {
  const degraded = report.degraded === 0 ? "" : `; ${report.degraded} kept only the formatting shared by their whole paragraph`;
  const resumed = report.resumed === 0 ? [] : [`Continued an interrupted run: ${report.resumed} blocks it had finished were skipped.`];
  const lines = [...resumed, `Transformed ${report.transformed} of ${report.total} blocks${degraded}.`];
  if (report.failures.length === 0) lines.push("The task is complete.");
  else lines.push(...list("Not transformed — fix these with document_edit if they matter:", report.failures, texts));
  if (report.skipped.length > 0) lines.push(...list("Left unchanged:", report.skipped, texts));
  // The planner never sees what the segments became; quoting real results keeps its reply from inventing them.
  const samples = [...report.samples].sort((left, right) => left.number - right.number).slice(0, sampleLimit);
  if (samples.length > 0) {
    lines.push("First results, to quote instead of guessing:");
    for (const sample of samples) lines.push(`- ${quote(sample.source)} → ${quote(sample.result)}`);
  }
  return lines.join("\n");
}

/**
 * @param text - Segment text with format tags and placeholders.
 * @returns Plain text in quotes, cut to a short excerpt.
 */
function quote(text: string): string {
  const plain = text.replace(/<\/?t\d+>|<x\d+\/>/gu, "").replaceAll("<br/>", " ");
  return JSON.stringify(plain.length > 40 ? `${plain.slice(0, 40)}…` : plain);
}

/**
 * @param title - List heading.
 * @param entries - Blocks with reasons.
 * @param texts - Plain block texts.
 * @returns Heading and one line per block, capped.
 */
function list(title: string, entries: readonly { readonly block: string; readonly reason: string }[], texts: ReadonlyMap<string, string>): string[] {
  const lines = [title];
  for (const entry of entries.slice(0, listedLimit)) {
    const text = texts.get(entry.block) ?? "";
    lines.push(`- block ${entry.block} "${text.length > 40 ? `${text.slice(0, 40)}…` : text}": ${entry.reason}`);
  }
  if (entries.length > listedLimit) lines.push(`- …and ${entries.length - listedLimit} more.`);
  return lines;
}
