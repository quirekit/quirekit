import type { Node as ProseMirrorNode } from "@quirekit/pm";
import { resolveWordDefaultTabInterval } from "@quirekit/classic-paragraph-model";
import { resolveWordParagraphStyleRegistry } from "@quirekit/classic-styles-model";
import type {
  ResolvedWordNumberingMarker,
  WordNumberingLevel,
  WordNumberingRegistry
} from "../types";
import { resolveWordNumberingRegistry } from "../model";
import { resolveWordEffectiveParagraphNumbering } from "./effective";
import { resolveEffectiveWordListIndentation } from "./indentation";
import { resolveWordNumberingTabs } from "./tabs";
import { formatWordNumberingMarker } from "./template";
import { advanceWordNumberingCounters } from "./counters";

/**
 * Resolves all generated Word list markers in document order.
 *
 * @param document - Canonical ProseMirror document.
 * @returns Marker records keyed by paragraph start position.
 */
export function resolveWordNumberingMarkers(
  document: ProseMirrorNode
): ReadonlyMap<number, ResolvedWordNumberingMarker> {
  // Layout and field evaluation both read the markers of each document.
  let markers = markersByDocument.get(document);
  if (markers === undefined) {
    markers = resolveDocumentMarkers(document);
    markersByDocument.set(document, markers);
  }
  return markers;
}

/** Resolved markers per immutable document. */
const markersByDocument = new WeakMap<ProseMirrorNode, ReadonlyMap<number, ResolvedWordNumberingMarker>>();

/**
 * Runs the document-order counter state machine once.
 *
 * @param document - Canonical ProseMirror document.
 * @returns Marker records keyed by paragraph start position.
 */
function resolveDocumentMarkers(
  document: ProseMirrorNode
): ReadonlyMap<number, ResolvedWordNumberingMarker> {
  const registry = resolveWordNumberingRegistry(
    document.attrs.wordNumberingRegistry
  );
  const styleRegistry = resolveWordParagraphStyleRegistry(
    document.attrs.wordStyleRegistry
  );
  const counters = new Map<string, Array<number | undefined>>();
  const markers = new Map<number, ResolvedWordNumberingMarker>();

  // Numbering is a document-order state machine. This traversal is the sole
  // counter authority; renderer backends receive only immutable marker records.
  document.descendants((node, position) => {
    if (!node.isTextblock) return true;
    const effective = resolveWordEffectiveParagraphNumbering(node, styleRegistry);
    if (effective === null) return false;
    const reference = effective.numbering;
    const resolved = resolveWordNumberingLevel(
      registry,
      reference.numId,
      reference.level
    );
    if (resolved === undefined) return false;
    const { level } = resolved;
    const kind = reference.task !== null ? "task" : level.format === "bullet" ? "bullet" : "ordered";
    const checked = reference.task?.checked ?? null;
    const generated = resolveOrderedMarkerText(
      reference.numId, reference.level, reference.startOverride, level, registry, counters
    );
    const text = checked === null ? generated : checked ? "☑" : "☐";
    markers.set(position, {
      position,
      text,
      counter: counters.get(reference.numId)![reference.level]!,
      counterValues: Object.freeze([...counters.get(reference.numId)!]),
      kind,
      numId: reference.numId,
      level: reference.level,
      suffix: level.suffix,
      justification: level.justification,
      levelIndentation: level.paragraphIndentation,
      tabs: resolveWordNumberingTabs(level, node, styleRegistry),
      defaultTabStopTwips: resolveWordDefaultTabInterval(document.attrs.wordSettings),
      indentation: resolveEffectiveWordListIndentation(
        level.paragraphIndentation,
        node,
        styleRegistry,
        effective.sourceStyleId
      ),
      checked,
      ...(level.markerStyle === undefined ? {} : { markerStyle: level.markerStyle })
    });
    return false;
  });

  return markers;
}

/**
 * Resolves one concrete instance and effective level definition.
 *
 * @param registry - Valid document numbering registry.
 * @param numId - Concrete instance id.
 * @param levelIndex - Zero-based level index.
 * @returns Definition and level, or undefined for a dangling reference.
 */
export function resolveWordNumberingLevel(
  registry: WordNumberingRegistry,
  numId: string,
  levelIndex: number
): {
  /** Abstract definition owning the level. */
  readonly definition: WordNumberingRegistry["abstractNums"][string];
  /** Effective level selected by the paragraph. */
  readonly level: WordNumberingLevel;
} | undefined {
  const instance = registry.nums[numId];
  const definition = instance === undefined
    ? undefined
    : registry.abstractNums[instance.abstractNumId];
  const level = definition?.levels[String(levelIndex)];
  return definition === undefined || level === undefined
    ? undefined
    : { definition, level };
}

/**
 * Advances one concrete counter and expands its marker template.
 *
 * @param numId - Concrete numbering instance id.
 * @param levelIndex - Current paragraph level.
 * @param startOverride - Optional paragraph-local restart value.
 * @param level - Effective current level.
 * @param registry - Document numbering registry.
 * @param counters - Mutable counters scoped to this resolver traversal.
 * @returns Expanded marker label.
 */
function resolveOrderedMarkerText(
  numId: string,
  levelIndex: number,
  startOverride: number | null,
  level: WordNumberingLevel,
  registry: WordNumberingRegistry,
  counters: Map<string, Array<number | undefined>>
): string {
  const values = counters.get(numId) ?? [];
  counters.set(numId, values);
  const definition = resolveWordNumberingLevel(registry, numId, levelIndex)!.definition;
  advanceWordNumberingCounters(values, level, startOverride, definition.levels);
  return formatWordNumberingMarker(level, definition.levels, values);
}
