import type { ChainedCommands, CommandProps } from "@quirekit/core";
import type { Node } from "@quirekit/pm";
import { applyQuireAiFormat } from "./execute";
import type { QuireAiEditPlan, QuireAiPlannedBlock } from "./types";

/**
 * Applies the inline formats of text inside created blocks, such as a table's cells, to the
 * block nodes themselves before the edit is written. The block then goes in as one complete
 * node: tracked changes record a whole new table only when nothing else edits it in the same write.
 * @param plan - Planned edit against the editor's current document.
 * @param dryRun - Creates a chain that never dispatches, such as `editor.can().chain()`.
 * @returns The plan with formatted block nodes.
 */
export function materializeQuireAiNestedFormats(plan: QuireAiEditPlan, dryRun: () => ChainedCommands): QuireAiEditPlan {
  if (!plan.planned.some(entry => entry.kind === "insert" && entry.blocks.some(block => (block.nested?.length ?? 0) > 0))) return plan;
  return {
    ...plan,
    planned: plan.planned.map(entry => entry.kind !== "insert" ? entry : {
      ...entry,
      blocks: entry.blocks.map(block => (block.nested?.length ?? 0) === 0 ? block : formatBlock(block, entry.at, dryRun))
    })
  };
}

/**
 * @param block - Created block with nested formats.
 * @param at - Insert position in the current document.
 * @param dryRun - Chain factory that never dispatches.
 * @returns The block with its formats in its node, or unchanged when they cannot be applied there.
 */
function formatBlock(block: QuireAiPlannedBlock, at: number, dryRun: () => ChainedCommands): QuireAiPlannedBlock {
  let formatted: Node | null = null;
  dryRun().command((props: CommandProps) => {
    props.tr.insert(at, block.node);
    for (const entry of block.nested ?? []) {
      for (const span of entry.spans) {
        if (!applyQuireAiFormat(props, { from: at + entry.offset + span.start, to: at + entry.offset + span.end }, span)) return false;
      }
    }
    formatted = props.tr.doc.nodeAt(at);
    return true;
  }).run();
  return formatted === null ? block : { ...block, node: formatted, nested: [] };
}
