import type { BlockInputContext, BlockInputResult, BlockInputRule } from "@quirekit/msfe-core";
import { continueDocumentMarkup, nextItemAfterBreak } from "./continuation";
import { enterNewFence } from "./fences/language";
import { breakInCell, tableFromHeader } from "./table";
import { documentInput, exitDocumentBlock, insertDocumentLineBreak, insertDocumentParagraph, openBlankRow } from "./paragraph";

/** @param context - Whole-selection input. @returns A paragraph split or delegation to its enclosing semantic block. */
export function paragraphInput({ state }: BlockInputContext): BlockInputResult {
  return tableFromHeader(state) ?? nextItemAfterBreak(state) ?? insertDocumentParagraph(state) ?? openBlankRow(state) ?? "parent";
}

/** @param context - Whole-selection input. @returns Native Markdown continuation with the product's empty-block exit rules. */
export function markupInput({ state }: BlockInputContext): BlockInputResult {
  return continueDocumentMarkup(state) ?? "native";
}

/** @param context - Whole-selection input. @returns A hard break preserving quote/list prefixes, or native fallback. */
export function lineBreakInput({ state }: BlockInputContext): BlockInputResult {
  return insertDocumentLineBreak(state) ?? "native";
}

/** @param context - Whole-selection input. @returns A paragraph after a complete enclosing block, or native fallback. */
export function exitInput({ state }: BlockInputContext): BlockInputResult {
  return exitDocumentBlock(state) ?? "native";
}

/** @param context - Whole-selection input. @returns A paragraph only after a complete fence; literal contents retain native input. */
export function fenceInput({ state }: BlockInputContext): BlockInputResult {
  return insertDocumentParagraph(state) ?? enterNewFence(state) ?? "native";
}

/** @param context - Whole-selection input. @returns A line break inside the cell in document mode; source-like table editing keeps native input. */
export function tableInput({ state }: BlockInputContext): BlockInputResult {
  return documentInput(state) ? breakInCell(state) ?? "native" : "native";
}

/** Product defaults; transparent paragraph leaves let list, quote and custom block owners decide. */
export const documentBlockInput: readonly BlockInputRule[] = [
  { nodes: ["Paragraph", "Task"] },
  { nodes: ["Document"], enter: paragraphInput, lineBreak: lineBreakInput, exit: exitInput },
  { nodes: ["HTMLBlock"], enter: "native", lineBreak: "native", exit: exitInput },
];
