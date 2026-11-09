import type { DocParagraphBaseFormat } from '../../../types'

/**
 * Creates the MS-DOC base-settings tuple, with no inherited or direct overrides.
 * @param styleIndex - Source style selected for the paragraph.
 * @returns Fresh independent settings, not an editor authoring preset.
 */
export function defaultParagraphFormat(styleIndex: number): DocParagraphBaseFormat {
  return { scope: 'paragraph-base', styleIndex, outlineLevel: 9, alignment: { value: 0, logical: false },
    leftIndent: { twips: 0, logical: false }, rightIndent: { twips: 0, logical: false },
    firstLineIndentTwips: 0, spacingBeforeTwips: 0, spacingAfterTwips: 0,
    lineSpacing: { value: 240, multiple: true }, tabs: { stops: [], changes: [], rangeDeletion: false }, shading: null, keepLines: false, keepNext: false,
    pageBreakBefore: false, widowControl: true, bidi: false, autoSpaceLatin: true, autoSpaceNumber: true, unsupportedOpcodes: [] }
}

/**
 * Isolates a cached style value and starts a fresh child/direct tab-edit layer.
 * @param format - Immutable cached base settings.
 * @returns Deeply independent mutable settings for this computation.
 */
export function copyParagraphFormat(format: DocParagraphBaseFormat): DocParagraphBaseFormat {
  return { ...format, alignment: { ...format.alignment }, leftIndent: { ...format.leftIndent },
    rightIndent: { ...format.rightIndent }, lineSpacing: { ...format.lineSpacing }, shading: format.shading ? { ...format.shading } : null,
    tabs: { stops: format.tabs.stops.map(stop => ({ ...stop })), changes: [], rangeDeletion: false },
    unsupportedOpcodes: [...format.unsupportedOpcodes] }
}
