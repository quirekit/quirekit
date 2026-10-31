import type { Node } from "@quirekit/pm";
import type { QuireAiRegistry } from "../types";
import { collectQuireAiSections } from "../view/collect";
import type { PlanBlock } from "./blocks";
import type { QuireAiPlannedOperation } from "./types";

/** Where an insert or a move lands, as the model names it. */
export interface QuireAiBoundaryRequest {
  /** Block the content follows. */
  readonly after?: string | undefined;
  /** Block the content precedes. */
  readonly before?: string | undefined;
  /** Start or end of the body. */
  readonly at?: "start" | "end" | undefined;
}

/**
 * Resolves the boundary an insert or a move lands at.
 * @param request - Exactly one of `after`, `before` or `at`.
 * @param block - Resolves a block id.
 * @param doc - Document.
 * @param registry - Compiled facts, naming the body.
 * @param fail - Reports an invalid request.
 * @returns Boundary position, and the neighbouring block new paragraphs take their type from.
 */
export function resolveQuireAiBoundary(
  request: QuireAiBoundaryRequest,
  block: (id: string) => PlanBlock,
  doc: Node,
  registry: QuireAiRegistry,
  fail: (message: string) => never
): { readonly at: number; readonly template?: Node } {
  const anchors = [request.after, request.before, request.at].filter(value => value !== undefined);
  if (anchors.length !== 1) fail("give exactly one of `after`, `before` or `at`.");
  if (request.after !== undefined) {
    const { pos, node } = block(request.after);
    return { at: pos + node.nodeSize, template: node };
  }
  if (request.before !== undefined) {
    const { pos, node } = block(request.before);
    return { at: pos, template: node };
  }
  const body = collectQuireAiSections(doc, registry).filter(section => !section.story);
  const section = request.at === "start" ? body[0]! : body.at(-1)!;
  return { at: request.at === "start" ? section.contentStart : section.contentStart + section.container.content.size };
}

/**
 * Plans moving adjacent sibling blocks, in their order, to a boundary.
 * @param source - Index of the operation as the model wrote it.
 * @param blocks - Blocks to move.
 * @param at - Boundary the blocks land at.
 * @param fail - Reports an invalid request.
 * @param tracked - Whether the move is written as tracked changes.
 * @returns Planned move.
 */
export function planQuireAiMove(
  source: number,
  blocks: readonly PlanBlock[],
  at: number,
  fail: (message: string) => never,
  tracked = false
): QuireAiPlannedOperation {
  const sorted = [...blocks].sort((left, right) => left.pos - right.pos);
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1];
    if (entry.parentStart !== first.parentStart || (previous !== undefined && previous.pos + previous.node.nodeSize !== entry.pos)) {
      fail("move adjacent blocks of one container at a time; send separate moves for blocks apart from each other.");
    }
  });
  const from = first.pos;
  const to = last.pos + last.node.nodeSize;
  if (at > from && at < to) fail("the target lies inside the moved blocks; choose a block outside them.");
  // Moving every block out of a container would leave it empty, which no container admits.
  if (sorted.length === first.parentChildCount) {
    fail(`block ${first.id} is the only content of its container; insert a copy where it should go and clear it instead.`);
  }
  // Revisions record a moved paragraph as a deletion and an insertion; a table or other object removed
  // in the same transaction as its copy lands is recorded wrongly, so such a move waits for full access.
  if (tracked && sorted.some(entry => !entry.node.isTextblock)) {
    fail("a table, picture or other object cannot be moved while changes are tracked; leave it in place and tell the user, who can move it with full access or by dragging it.");
  }
  return { source, kind: "move", from, to, at };
}
