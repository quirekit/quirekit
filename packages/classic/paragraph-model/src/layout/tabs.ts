import type { WordParagraphFormatting } from "../types";
import type { WordParagraphModelFormatting } from "./types";

/**
 * Projects admitted absolute stops without exposing Word units to the engine.
 *
 * Unadmitted stops remain canonical and round-trip through DOCX. No projection
 * is preferable to guessing decimal/bar semantics during pagination. Exact clear
 * instructions have already removed inherited positions and carry no geometry.
 *
 * @param formatting - Effective paragraph formatting after style resolution.
 * @param defaultIntervalTwips - Effective document interval only for a paragraph with literal tabs.
 * @returns Neutral explicit stops, or undefined for inherited/unsupported tabs.
 */
export function projectWordParagraphTabs(
  formatting: WordParagraphFormatting,
  defaultIntervalTwips?: number
): WordParagraphModelFormatting["tabs"] {
  if (formatting.tabs?.some(stop => stop.position.unit !== 'dxa')) return undefined;
  // Direct-only profiles can still carry source operations. Resolve final
  // same-position writes before removing clear, so a later clear cannot expose
  // an earlier stop that the author explicitly removed.
  const stops = formatting.tabs == null ? undefined
    : [...new Map(formatting.tabs.map(stop => [stop.position.value, stop] as const)).values()]
      .filter(stop => stop.alignment !== 'clear');
  if (stops?.some((stop) =>
    !["start", "end", "center"].includes(stop.alignment)
    || (stop.leader != null && !["none", "dot", "hyphen", "underscore"].includes(stop.leader))
  )) return undefined;
  if (!stops?.length && defaultIntervalTwips === undefined) return undefined;
  return { ...(defaultIntervalTwips === undefined ? {} : { defaultInterval: defaultIntervalTwips / 15 }), stops: (stops ?? []).map((stop) => ({
    position: stop.position.value / 15,
    alignment: stop.alignment as "start" | "end" | "center",
    ...(!stop.leader || stop.leader === "none" ? {} : { leader: ({ dot: ".", hyphen: "-", underscore: "_" } as Record<string, string>)[stop.leader]! })
  })).sort((a, b) => a.position - b.position) };
}

/**
 * Resolves the shared document tab default without mutating canonical settings.
 * @param settings - Stored Word document settings, possibly absent or malformed.
 * @returns Positive twip interval, with Word's 720-twip fallback.
 */
export function resolveWordDefaultTabInterval(settings: unknown): number {
  const value = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).defaultTabStop : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 720;
}
