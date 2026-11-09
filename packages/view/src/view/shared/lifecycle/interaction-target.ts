import type { QuireMountedInteractionTargetSnapshot } from "@quirekit/core";
import { NodeSelection, type Selection } from "@quirekit/pm";
import {
  resolveQuireActiveSelectionContext,
  type QuireActiveSelectionContext,
  type QuireInteractionSelectionTarget
} from "@quirekit/view-engine";

/**
 * Drops an exact node or object hit once its node selection is gone, such as after
 * arrow keys move the caret off it, so the new caret edits text again.
 *
 * @param target - Retained interaction target.
 * @param selection - Current PM selection.
 * @returns Target that still owns routing, or null.
 */
export function readLiveMountedInteractionTarget(
  target: QuireInteractionSelectionTarget | null,
  selection: Selection
): QuireInteractionSelectionTarget | null {
  const exact = target?.domain === "node" || target?.domain === "object";
  return exact && !(selection instanceof NodeSelection) ? null : target;
}

/**
 * Resolves the selection context owned by a live retained target.
 * @param target - Live retained target.
 * @param selection - Current PM selection.
 * @returns Target-owned selection context, or undefined without one.
 */
export function resolveMountedSelectionContext(
  target: QuireInteractionSelectionTarget | null,
  selection: Selection
): QuireActiveSelectionContext | undefined {
  return target === null ? undefined : resolveQuireActiveSelectionContext({ selection, interactionTarget: target });
}

/**
 * Projects retained interaction authority into the clone-safe mounted-view contract.
 *
 * The projection deliberately exposes semantic facts instead of the internal
 * retained graph objects. Product integrations can therefore consume the View's
 * routing decision without reconstructing it from selection or layout geometry.
 *
 * @param target - Current retained interaction target owned by the mounted View.
 * @returns Frozen clone-safe target facts, or null without retained ownership.
 */
export function createMountedInteractionTargetSnapshot(
  target: QuireInteractionSelectionTarget | null
): QuireMountedInteractionTargetSnapshot | null {
  if (target === null) {
    return null;
  }

  const contentControlHit = target.interactionHit?.kind === "content-control"
    ? target.interactionHit
    : undefined;
  const objectHit = target.interactionHit?.kind === "object"
    ? target.interactionHit
    : undefined;
  const owner = contentControlHit === undefined
    ? objectHit === undefined
      ? undefined
      : Object.freeze({ kind: "object", id: objectHit.objectId })
    : Object.freeze({
        kind: "content-control",
        id: contentControlHit.controlId
      });
  const visualInstanceId = objectHit?.region.visualInstanceId;
  const referenceRect = target.referenceRect === undefined
    ? undefined
    : Object.freeze({ ...target.referenceRect });
  const pointerPolicy = target.pointerPolicy === undefined
    ? undefined
    : Object.freeze({ ...target.pointerPolicy });

  return Object.freeze({
    targetKind: target.hitKind,
    selectionDomain: target.domain,
    commandTarget: target.commandTarget,
    ...(owner === undefined ? {} : { owner }),
    ...(visualInstanceId === undefined ? {} : { visualInstanceId }),
    ...(contentControlHit === undefined
      ? {}
      : {
          role: contentControlHit.controlType,
          part: contentControlHit.part,
          range: Object.freeze({ ...contentControlHit.range })
        }),
    ...(referenceRect === undefined ? {} : { referenceRect }),
    ...(pointerPolicy === undefined ? {} : { pointerPolicy })
  });
}
