import {
  defaultWordParagraphFormatting,
  resolveWordParagraphFormatting,
  type WordParagraphFormatting,
  type WordParagraphFormattingPatch
} from "@quirekit/classic-paragraph-model";
import { mergeWordParagraphBorders } from "./decorations";
import { mergeWordParagraphTabs } from "./tabs/merge";

/**
 * Merges one paragraph property delta over inherited effective formatting.
 *
 * Nested Word records merge field-by-field so explicit `false` wins while
 * `null` keeps inheriting. Preservation metadata remains paragraph-local.
 *
 * @param inherited - Effective inherited paragraph formatting.
 * @param delta - Style or direct-formatting delta.
 * @returns Effective formatting after the delta.
 */
export function mergeWordParagraphFormatting(
  inherited: WordParagraphFormatting = defaultWordParagraphFormatting,
  delta: WordParagraphFormattingPatch | WordParagraphFormatting
): WordParagraphFormatting {
  const isDirectFormatting = "preservation" in delta;
  const normalized: WordParagraphFormattingPatch | WordParagraphFormatting =
    isDirectFormatting
      ? resolveWordParagraphFormatting(delta)
      : delta;
  return {
    ...inherited,
    styleId: readScalar(normalized.styleId, inherited.styleId),
    outlineLevel: readScalar(normalized.outlineLevel, inherited.outlineLevel),
    alignment: readScalar(normalized.alignment, inherited.alignment),
    direction: readScalar(normalized.direction, inherited.direction),
    indentation: {
      start: readNested(
        normalized.indentation?.start,
        inherited.indentation.start
      ),
      end: readNested(normalized.indentation?.end, inherited.indentation.end),
      firstLine: readNested(
        normalized.indentation?.firstLine,
        inherited.indentation.firstLine
      )
    },
    tabs: mergeWordParagraphTabs(inherited.tabs, normalized.tabs),
    spacing: {
      before: readNested(normalized.spacing?.before, inherited.spacing.before),
      beforeLines: readNested(
        normalized.spacing?.beforeLines,
        inherited.spacing.beforeLines
      ),
      beforeAutoSpacing: readNested(
        normalized.spacing?.beforeAutoSpacing,
        inherited.spacing.beforeAutoSpacing
      ),
      after: readNested(normalized.spacing?.after, inherited.spacing.after),
      afterLines: readNested(
        normalized.spacing?.afterLines,
        inherited.spacing.afterLines
      ),
      afterAutoSpacing: readNested(
        normalized.spacing?.afterAutoSpacing,
        inherited.spacing.afterAutoSpacing
      ),
      line: readNested(normalized.spacing?.line, inherited.spacing.line)
    },
    pagination: {
      widowControl: readNested(
        normalized.pagination?.widowControl,
        inherited.pagination.widowControl
      ),
      keepNext: readNested(
        normalized.pagination?.keepNext,
        inherited.pagination.keepNext
      ),
      keepLines: readNested(
        normalized.pagination?.keepLines,
        inherited.pagination.keepLines
      ),
      pageBreakBefore: readNested(
        normalized.pagination?.pageBreakBefore,
        inherited.pagination.pageBreakBefore
      )
    },
    documentGrid: {
      adjustRightIndent: readNested(
        normalized.documentGrid?.adjustRightIndent,
        inherited.documentGrid.adjustRightIndent
      ),
      snapToGrid: readNested(
        normalized.documentGrid?.snapToGrid,
        inherited.documentGrid.snapToGrid
      )
    },
    eastAsianLayout: {
      autoSpaceLatin: readNested(
        normalized.eastAsianLayout?.autoSpaceLatin,
        inherited.eastAsianLayout.autoSpaceLatin
      ),
      autoSpaceNumber: readNested(
        normalized.eastAsianLayout?.autoSpaceNumber,
        inherited.eastAsianLayout.autoSpaceNumber
      ),
      wordWrap: readNested(
        normalized.eastAsianLayout?.wordWrap,
        inherited.eastAsianLayout.wordWrap
      ),
      kinsoku: readNested(
        normalized.eastAsianLayout?.kinsoku,
        inherited.eastAsianLayout.kinsoku
      ),
      overflowPunctuation: readNested(
        normalized.eastAsianLayout?.overflowPunctuation,
        inherited.eastAsianLayout.overflowPunctuation
      ),
      compressLineStartPunctuation: readNested(
        normalized.eastAsianLayout?.compressLineStartPunctuation,
        inherited.eastAsianLayout.compressLineStartPunctuation
      )
    },
    borders: mergeWordParagraphBorders(
      inherited.borders ?? null,
      normalized.borders
    ),
    shading: readScalar(
      normalized.shading,
      inherited.shading ?? null
    ),
    markFormatting: readScalar(
      normalized.markFormatting,
      inherited.markFormatting ?? null
    ),
    preservation: isDirectFormatting
      ? (normalized as WordParagraphFormatting).preservation
      : inherited.preservation
  };
}

/**
 * Reads a scalar delta where null and undefined mean inherit.
 *
 * @param value - Candidate scalar delta.
 * @param inherited - Inherited scalar value.
 * @returns Explicit delta or inherited value.
 */
function readScalar<Value>(
  value: Value | null | undefined,
  inherited: Value
): Value {
  return value === null || value === undefined ? inherited : value;
}

/**
 * Reads one nested delta where null and undefined mean inherit.
 *
 * @param value - Candidate nested delta.
 * @param inherited - Inherited nested value.
 * @returns Explicit delta or inherited value.
 */
function readNested<Value>(
  value: Value | null | undefined,
  inherited: Value | null
): Value | null {
  return value === null || value === undefined ? inherited : value;
}
