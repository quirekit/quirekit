import type { CommandSpec } from "@quirekit/core";
import type {
  RestartWordNumberingAtPositionOptions,
  RestartWordNumberingOptions,
  WordNumberingAtPositionOptions
} from "../types";
import { resolveWordParagraphNumbering } from "../model";
import { readWordNumberingSequenceActionState } from "../selection";
import { relinkWordNumberingSequenceTail } from "./sequence-tail";
import { collectWordNumberingCommandTargets } from "./targets";

/**
 * Creates restart or continue commands for selected numbered paragraphs.
 *
 * @param mode - Write a start override or clear it.
 * @param paragraphTypes - Registered paragraph-like node names.
 * @returns Numbering sequence command.
 */
export function createWordNumberingSequenceCommand(
  mode: "restart" | "continue",
  paragraphTypes: readonly string[]
): CommandSpec {
  return (value) => (context) => {
    const start = mode === "restart" ? readStart(value) : null;
    if (mode === "restart" && start === undefined) return false;
    const targets = collectWordNumberingCommandTargets(context, paragraphTypes)
      .map((target) => ({
        target,
        numbering: resolveWordParagraphNumbering(target.node.attrs.wordNumbering)
      }))
      .filter((entry) => entry.numbering !== null);
    let changed = false;
    for (const [index, entry] of targets.entries()) {
      const numbering = entry.numbering;
      if (numbering === null) continue;
      if (mode === "continue") {
        const actions = readWordNumberingSequenceActionState(
          { doc: context.tr.doc }, entry.target.position, paragraphTypes
        );
        if (!actions?.canContinue) continue;
        if (actions.continuationNumId !== null && actions.continuationNumId !== numbering.numId) {
          relinkWordNumberingSequenceTail({ context, position: entry.target.position,
            sourceNumId: numbering.numId, continuationNumId: actions.continuationNumId,
            level: numbering.level, paragraphTypes });
          changed = true;
          continue;
        }
      }
      const nextStart = mode === "restart" && index === 0 ? start : null;
      if (numbering.startOverride === nextStart) continue;
      context.tr.setNodeMarkup(entry.target.position, undefined, {
        ...entry.target.node.attrs,
        wordNumbering: { ...numbering, startOverride: nextStart }
      });
      changed = true;
    }
    if (!changed) return false;
    context.dispatch?.(context.tr);
    return true;
  };
}

/**
 * Creates an exact marker-owned restart or continue command.
 *
 * @param mode - Write a non-negative start override or clear the local override.
 * @param paragraphTypes - Registered paragraph-like node names.
 * @returns Command that mutates one numbered paragraph without moving selection.
 */
export function createWordNumberingSequenceAtPositionCommand(
  mode: "restart" | "continue",
  paragraphTypes: readonly string[]
): CommandSpec {
  const allowedTypes = new Set(paragraphTypes);
  return (value) => (context) => {
    const position = readPosition(value);
    const start = mode === "restart" ? readStart(value) : null;
    if (position === undefined || (mode === "restart" && start === undefined)) {
      return false;
    }
    const node = context.state.doc.nodeAt(position);
    if (node === null || !node.isTextblock || !allowedTypes.has(node.type.name)) {
      return false;
    }
    const numbering = resolveWordParagraphNumbering(node.attrs.wordNumbering);
    if (numbering === null) return false;
    const actions = readWordNumberingSequenceActionState(
      context.state,
      position,
      paragraphTypes
    );
    if (
      actions === undefined
      || (mode === "restart" && !actions.canRestart)
      || (mode === "continue" && !actions.canContinue)
    ) {
      return false;
    }
    const nextNumbering = mode === "restart"
      ? { ...numbering, startOverride: start ?? null }
      : actions.continuationNumId === null
        ? { ...numbering, startOverride: null }
        : {
            ...numbering,
            numId: actions.continuationNumId,
            startOverride: null
          };
    if (
      nextNumbering.numId === numbering.numId
      && nextNumbering.startOverride === numbering.startOverride
    ) {
      return false;
    }
    if (mode === "continue" && actions.continuationNumId !== null
      && actions.continuationNumId !== numbering.numId) {
      relinkWordNumberingSequenceTail({
        context,
        position,
        sourceNumId: numbering.numId,
        continuationNumId: actions.continuationNumId,
        level: numbering.level,
        paragraphTypes
      });
    } else {
      context.tr.setNodeMarkup(position, undefined, {
        ...node.attrs,
        wordNumbering: nextNumbering
      });
    }
    context.dispatch?.(context.tr);
    return true;
  };
}

/**
 * Validates one non-negative restart value.
 *
 * @param value - Candidate restart payload.
 * @returns Non-negative integer or undefined.
 */
function readStart(value: unknown): number | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const start = (value as RestartWordNumberingOptions).start;
  return Number.isInteger(start) && start >= 0 ? start : undefined;
}

/**
 * Reads one exact paragraph position from a marker command payload.
 *
 * @param value - Candidate marker payload.
 * @returns Non-negative document position, or undefined when invalid.
 */
function readPosition(value: unknown): number | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const position = (
    value as WordNumberingAtPositionOptions | RestartWordNumberingAtPositionOptions
  ).position;
  return Number.isInteger(position) && position >= 0 ? position : undefined;
}
