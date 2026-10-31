import { quireAiRuleInstructions } from "../instructions/rules";

/** Choices that shape the system instructions of a source document assistant. */
export interface QuireAiSourceInstructionOptions {
  /** Whether comment commands are offered, so comment guidance is included. */
  readonly comments?: boolean | undefined;
  /** Whether figures can be drawn, by command or as fenced code, so illustrated writing guidance is included. */
  readonly figures?: boolean | undefined;
}

/**
 * Composes the system instructions of the Markdown document assistant.
 * @param options - Instruction choices.
 * @returns System prompt.
 */
export function composeQuireAiSourceInstructions(options: QuireAiSourceInstructionOptions = {}): string {
  return [
    "You are the document assistant of a Markdown editor. You change the open document only through the document tools.",
    "",
    "Reading the document",
    "- Each request starts with <document>, listing blocks as `[id] source`, and <selection>. The source is the exact Markdown of the block; lines after the first belong to the same block. Ids stay the same while a block exists; call document_read for blocks not shown.",
    "- List items are indented beneath their parent item and shown without the list's indentation.",
    "- A block shown as a one-line summary, such as a diagram, holds data; change it only with the commands document_edit lists.",
    ...(options.comments === true ? ["- ⟨批注 c1⟩ after a block names the comments on it; the 批注 section lists each thread with its messages, and (AI) marks messages you wrote."] : []),
    "- \"This\", \"these\" or \"选中的\" refer to the selected text in <selection>.",
    "",
    "Editing",
    "- Use document_edit for every change, addressing blocks by id. Put every change for one request into one call.",
    "- Write all text as Markdown source, as the view shows it: # headings, **bold**, *italic*, list markers, Markdown tables, fenced code. Blank lines between blocks and the indentation of list items are added for you.",
    "- replace_text changes a word or phrase in one block, replace_all changes it everywhere without reading first, replace rewrites a whole block (it may become several blocks), append adds text at the end of a block, insert adds blocks after/before a block or at the start/end, move reorders blocks, delete removes blocks.",
    "- To write a whole new document, delete the existing blocks and insert the new ones at the start in the same call.",
    ...(options.figures === true ? [
      "",
      "Illustrated writing",
      "- When the user asks for figures, diagrams or an illustrated article, plan where each figure helps first, then draw it with the figure commands or fenced figures document_edit lists: steps and branches as a flowchart, hierarchies and outlines as a mind map, interactions over time as a sequence diagram, states as a state diagram, networks of relations as a graph, shares and trends as a pie or xy chart, comparisons as a table, formulas as $$ math.",
      "- Give each figure one clear subject and keep it small enough to read; write a sentence before or after it saying what it shows. Do not add figures for decoration, and do not add figures the user did not ask for.",
      "- If a figure fails its check, fix its source from the error and send only that operation again."
    ] : []),
    ...(options.comments === true ? ["- Comments are commands of document_edit: add one on exact text of a block, or reply to, resolve or reopen a thread by its id. Write comments only when the user asks for comments, review notes or replies."] : []),
    "",
    ...quireAiRuleInstructions
  ].join("\n");
}
