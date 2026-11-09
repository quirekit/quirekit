import type { Node as ProseMirrorNode } from "@quirekit/pm";
import type {
  HtmlContainerDesc,
  HtmlDescriptorSourceResolver
} from "../../descriptors";
import type { HtmlTargetDescriptor } from "../types";
import type { HtmlContainerTarget } from "./types";
import type { HtmlNodeViewEnvironment } from "../../node-view/types";
import { createHtmlDecoratedChildren } from "../../node-view/children";

/**
 * Resolves a dirty container against the next canonical document.
 *
 * @param container - Dirty retained container.
 * @param documentNode - Next canonical document.
 * @returns Container target, or null when mapped ownership is absent.
 */
export function resolveHtmlContainerTarget(
  container: HtmlContainerDesc,
  documentNode: ProseMirrorNode
): HtmlContainerTarget | null {
  if (container.kind === "document") {
    return { node: documentNode };
  }
  const node = documentNode.nodeAt(container.range.from);

  if (!node) {
    return null;
  }
  if (container.kind === "node") {
    return !node.isText && node.type === container.node.type ? { node } : null;
  }
  if (container.kind === "node-view") {
    return !node.isText && container.host?.canRepresent(node) ? { node } : null;
  }
  if (container.kind === "mark" || container.kind === "inline-decoration") {
    // A wrapper may start inside a text run. A split can also map it across
    // block tokens; those scopes must be reconciled by a valid ancestor.
    const text = documentNode.resolve(container.range.from).nodeAfter;
    const length = container.range.to - container.range.from;
    if (!text?.isText || length <= 0 || length > text.nodeSize) return null;
    const target = text.cut(0, length);
    if (container.kind === "inline-decoration") return { node: target };
    const markIndex = target.marks.findIndex(mark => mark.eq(container.mark));
    return markIndex < 0 ? null : { node: target, markIndex };
  }
  return null;
}

/**
 * Creates desired direct children for one dirty retained container.
 *
 * @param container - Parent descriptor that bounds matching.
 * @param target - Canonical node or mark product represented by the parent.
 * @param resolveSource - Optional resolver for explicit node source identity.
 * @param nodeViewEnvironment - Optional exact node and mark factory environment.
 * @returns Desired direct child descriptors in document order.
 */
export function createHtmlTargetChildren(
  container: HtmlContainerDesc,
  target: HtmlContainerTarget,
  resolveSource?: HtmlDescriptorSourceResolver,
  nodeViewEnvironment?: HtmlNodeViewEnvironment
): HtmlTargetDescriptor[] {
  if (
    (container.kind === "node-view" && !container.host?.contentDOM) ||
    (container.kind === "mark" && container.factory && !container.host?.contentDOM)
  ) {
    return [];
  }
  if (container.kind === "mark") {
    return [createTextTarget(
      target.node,
      container.range.from,
      container.range.to,
      (target.markIndex ?? 0) + 1,
      container,
      container.source,
      nodeViewEnvironment
    )];
  }
  if (container.kind === "inline-decoration") return [createTextTarget(target.node, container.range.from, container.range.to, 0, container, container.source, nodeViewEnvironment)];
  const targets: HtmlTargetDescriptor[] = [];
  for (const child of createHtmlDecoratedChildren(
    container,
    target.node,
    nodeViewEnvironment
  )) {
    if (child.kind === "widget") {
      targets.push({
        kind: "widget",
        node: target.node,
        range: child.range,
        source: container.source,
        widgetDecoration: child.widget!.decoration,
        widgetKey: child.widget!.key,
        widgetSide: child.widget!.side
      });
      continue;
    }
    const node = child.node!;
    const source = resolveSource?.(node, container.source) ?? container.source;
    const nodeViewFactory = nodeViewEnvironment?.nodeViews[node.type.name];

    targets.push(node.isText
      ? child.inlineAttrs ? { kind: "inline-decoration", node, range: child.range, source, inlineAttrs: child.inlineAttrs } : createTextTarget(
          node,
          child.range.from,
          child.range.to,
          0,
          container,
          source,
          nodeViewEnvironment
        )
      : nodeViewFactory
        ? {
            kind: "node-view",
            node,
            range: child.range,
            source,
            nodeViewFactory,
            outerDecorations: child.outerDecorations,
            innerDecorations: child.innerDecorations
          }
        : { kind: "node", node, range: child.range, source });
  }
  return targets;
}

/**
 * Creates a mark-wrapper or direct-text target at one mark depth.
 *
 * @param node - ProseMirror text node represented by the target.
 * @param from - Start of the text span.
 * @param to - End of the text span.
 * @param markIndex - Mark depth to realize.
 * @param container - Parent descriptor supplying source identity.
 * @param source - Explicit or inherited target source identity.
 * @param nodeViewEnvironment - Optional exact mark factory environment.
 * @returns Desired mark or text target.
 */
function createTextTarget(
  node: ProseMirrorNode,
  from: number,
  to: number,
  markIndex: number,
  container: HtmlContainerDesc,
  source = container.source,
  nodeViewEnvironment?: HtmlNodeViewEnvironment
): HtmlTargetDescriptor {
  const mark = node.marks[markIndex];

  return mark
    ? {
        kind: "mark",
        node,
        mark,
        markIndex,
        range: { from, to },
        source,
        markViewFactory: nodeViewEnvironment?.markViews[mark.type.name]
      }
    : { kind: "text", node, range: { from, to }, source };
}
