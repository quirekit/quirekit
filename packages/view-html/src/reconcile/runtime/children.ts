import type { HtmlContainerDesc, HtmlDescriptor } from "../../descriptors";
import { createHtmlTargetDescriptor } from "./create-target";
import { patchHtmlMarkMarkup, patchHtmlNodeMarkup } from "./markup";
import { matchHtmlDescriptorChildren } from "../match";
import {
  createHtmlTargetChildren
} from "../matching/targets";
import { createHtmlCandidateShellTargets } from "../matching/shell";
import type { HtmlContainerTarget } from "../matching/types";
import type { HtmlTargetDescriptor } from "../types";
import type { HtmlReconcileContext } from "./types";
import { resolveHtmlNodeViewDecorations } from "../../node-view/decorations";
import { walkHtmlDescriptors } from "../ownership/descriptor-tree";

/**
 * Reconciles one dirty parent's direct children and changed descendants.
 *
 * @param parent - Dirty parent that bounds matching and DOM writes.
 * @param target - Canonical product represented by the parent.
 * @param context - Shared allocation, patch, and diagnostic state.
 */
export function reconcileHtmlContainer(
  parent: HtmlContainerDesc,
  target: HtmlContainerTarget,
  context: HtmlReconcileContext
): void {
  const targets = createHtmlCandidateShellTargets(
    createHtmlTargetChildren(
      parent,
      target,
      context.resolveSource,
      context.nodeViewEnvironment
    ),
    context.ownerDocument
  );
  const matched = matchHtmlDescriptorChildren(parent, targets);
  const nextChildren: HtmlDescriptor[] = [];

  context.diagnostics.push(...matched.diagnostics);

  // Remove obsolete children first so subsequent placement indices describe
  // final parent order and do not trace avoidable shifts as DOM moves.
  for (const removal of matched.removals) {
    context.patchHost.removeChild(parent, removal);
    removal.destroy();
  }
  for (let index = 0; index < targets.length; index += 1) {
    const targetChild = targets[index];
    const existing = matched.matches[index];

    if (!targetChild) {
      continue;
    }
    context.trace.descriptorVisits += 1;
    const child = existing
      ? updateMatchedDescriptor(parent, existing, targetChild, context)
      : createHtmlTargetDescriptor(parent, targetChild, context);

    nextChildren.push(child);
    context.patchHost.placeChild(parent, child, index);
  }
  if (parent.children.length !== nextChildren.length || parent.children.some((child, index) => child !== nextChildren[index])) {
    context.ownershipChanged = true;
  }
  parent.adoptChildren(nextChildren);
  updateContainerProduct(parent, target);
}

/**
 * Updates one matched descriptor and recursively reconciles changed content.
 *
 * @param descriptor - Existing compatible descriptor.
 * @param parent - Parent that bounds replacement writes.
 * @param target - Desired next-document child.
 * @param context - Shared reconciliation state.
 * @returns Same retained descriptor identity.
 */
function updateMatchedDescriptor(
  parent: HtmlContainerDesc,
  descriptor: HtmlDescriptor,
  target: HtmlTargetDescriptor,
  context: HtmlReconcileContext
): HtmlDescriptor {
  // Equivalent siblings can be reused at a different mapped position. Their
  // descendants must then be reconciled in the new parent's coordinate range.
  const rangeChanged = descriptor.range.from !== target.range.from || descriptor.range.to !== target.range.to;
  if (rangeChanged && (descriptor.kind === "node" || descriptor.kind === "node-view")
    && descriptor.node.content.eq(target.node.content)) {
    // A retained parent with identical content proves its child identities still
    // belong together, even when a delete/insert move invalidated their ranges.
    // Child reconciliation below restores their exact target coordinates.
    walkHtmlDescriptors(descriptor, child => child.setDirtyState("mapped"));
  }
  if (descriptor.kind === "widget") {
    if (!target.widgetDecoration) {
      throw new RangeError("Retained widget targets require a decoration.");
    }
    descriptor.updateWidget(
      target.widgetDecoration,
      target.range,
      target.widgetSide ?? 0
    );
  } else if (descriptor.kind === "text") {
    context.patchHost.patchText(descriptor, target.node.text ?? "");
    descriptor.updateText(target.node, target.range, false);
  } else if (descriptor.kind === "node-view") {
    // A custom update can change mounted content holes and child attachment.
    context.ownershipChanged = true;
    const contentChanged = !descriptor.node.content.eq(target.node.content);
    const decorationState = resolveHtmlNodeViewDecorations(
      context.nodeViewEnvironment,
      parent,
      target.node,
      target.range
    );
    context.trace.nodeViewUpdateAttempts += 1;
    const retained = descriptor.host?.update({
      node: target.node,
      decorations: decorationState.decorations,
      innerDecorations: decorationState.innerDecorations
    }) === true;

    if (!retained) {
      context.patchHost.removeChild(parent, descriptor);
      descriptor.destroy();
      return createHtmlTargetDescriptor(parent, target, context);
    }
    descriptor.updateNode(target.node, target.range);
    if ((contentChanged || rangeChanged || context.decorationsChanged) && descriptor.host?.contentDOM) {
      reconcileHtmlContainer(descriptor, { node: target.node }, context);
    }
  } else if (descriptor.kind === "node") {
    const contentChanged = !descriptor.node.content.eq(target.node.content);

    patchHtmlNodeMarkup(descriptor, target, context);
    descriptor.updateNode(target.node, target.range);
    if (contentChanged || rangeChanged || context.decorationsChanged) {
      reconcileHtmlContainer(descriptor, { node: target.node }, context);
    }
  } else if (descriptor.kind === "inline-decoration") {
    const changed = !descriptor.node.eq(target.node);
    descriptor.node = target.node; descriptor.range = target.range;
    if (changed || rangeChanged) reconcileHtmlContainer(descriptor, { node: target.node }, context);
  } else if (descriptor.kind === "mark" && target.mark) {
    const contentChanged = !descriptor.children.every((child) => (
      child.kind === "text" && child.node.eq(target.node)
    ));

    patchHtmlMarkMarkup(descriptor, target, context);
    descriptor.updateMark(target.mark, target.range);
    if (contentChanged || rangeChanged) {
      reconcileHtmlContainer(descriptor, {
        node: target.node,
        markIndex: target.markIndex
      }, context);
    }
  }
  descriptor.setDirtyState("clean");
  return descriptor;
}

/**
 * Advances the canonical node or mark represented by a reconciled container.
 *
 * @param container - Reconciled retained container.
 * @param target - Canonical product represented by the container.
 */
function updateContainerProduct(
  container: HtmlContainerDesc,
  target: HtmlContainerTarget
): void {
  if (container.kind === "document") {
    container.updateNode(target.node, { from: 0, to: target.node.content.size });
  } else if (container.kind === "node" || container.kind === "node-view") {
    container.updateNode(target.node, container.range);
  } else if (container.kind === "inline-decoration") {
    container.node = target.node;
  } else if (container.kind === "mark") {
    const mark = target.node.marks[target.markIndex ?? -1];

    if (mark) {
      container.updateMark(mark, container.range);
    }
  }
  container.setDirtyState("clean");
}
