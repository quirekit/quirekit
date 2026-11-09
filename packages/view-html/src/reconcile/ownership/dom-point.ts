import type {
  HtmlContainerDesc,
  HtmlDescriptor
} from "../../descriptors";
import { htmlDescriptorContentRange, isHtmlContainerDescriptor } from "./descriptor-tree";
import { resolveHtmlChildBoundaryOwners } from "./child-boundary";
import { HtmlDomMappingGapError } from "./mapping-gap";

/**
 * Finds an unrepresented semantic owner at a requested boundary side.
 *
 * @param descriptors - Ordered semantic position index.
 * @param represented - Descriptors participating in the mounted DOM tree.
 * @param pos - Canonical document position.
 * @param side - Preferred side at a descriptor boundary.
 * @returns Most specific unrepresented owner, or undefined.
 */
export function findHtmlUnrepresentedDescriptor(
  descriptors: readonly HtmlDescriptor[],
  represented: ReadonlySet<HtmlDescriptor>,
  pos: number,
  side: number
): HtmlDescriptor | undefined {
  return [...descriptors].reverse().find((descriptor) => {
    if (descriptor.kind === "document" || represented.has(descriptor)) {
      return false;
    }
    if (descriptor.range.from < pos && pos < descriptor.range.to) {
      return true;
    }
    return side < 0
      ? descriptor.range.to === pos
      : descriptor.range.from === pos;
  });
}

/**
 * Finds the deepest retained container whose content includes a position.
 *
 * @param descriptors - Ordered retained position index.
 * @param pos - Canonical document position.
 * @returns Deepest containing descriptor, or undefined.
 */
export function findHtmlDeepestContainer(
  descriptors: readonly HtmlDescriptor[],
  pos: number
): HtmlContainerDesc | undefined {
  return descriptors.filter(isHtmlContainerDescriptor).filter((descriptor) => {
    const range = htmlDescriptorContentRange(descriptor);

    return range.from <= pos && pos <= range.to;
  }).at(-1);
}

/**
 * Resolves a canonical position to a retained child offset.
 *
 * @param container - Descriptor whose content DOM owns the point.
 * @param pos - Canonical document position.
 * @returns Child offset in retained DOM order.
 */
export function htmlChildOffsetAtPosition(
  container: HtmlContainerDesc,
  pos: number
): number {
  const index = container.children.findIndex((child) => pos <= child.range.from);

  return index < 0 ? container.children.length : index;
}

/**
 * Resolves a retained content-DOM offset without dataset or ancestor traversal.
 *
 * @param container - Descriptor that directly owns the DOM node.
 * @param offset - DOM child offset.
 * @param bias - Preferred side when the offset names a retained boundary.
 * @param owners - Direct DOM-to-descriptor ownership map.
 * @returns Canonical document position.
 */
export function positionAtHtmlChildOffset(
  container: HtmlContainerDesc,
  offset: number,
  bias: number,
  owners: WeakMap<Node, HtmlDescriptor>
): number {
  const contentDOM = container.mount?.contentDOM;

  if (!contentDOM || offset < 0 || offset > contentDOM.childNodes.length) {
    throw new HtmlDomMappingGapError(
      `DOM offset ${offset} is outside retained owner "${container.id}".`
    );
  }
  const [before, after] = resolveHtmlChildBoundaryOwners(container, offset, owners);

  if (bias > 0 && after?.parent === container) {
    return after.range.from;
  }
  if (before?.parent === container) {
    return before.range.to;
  }
  return htmlDescriptorContentRange(container).from;
}

/**
 * Requires a mounted descriptor DOM product.
 *
 * @param descriptor - Descriptor expected to be represented.
 * @param message - Explicit mapping-gap detail.
 * @returns Mounted root DOM node.
 */
export function requireHtmlMountedDOM(
  descriptor: HtmlDescriptor,
  message: string
): Node {
  if (!descriptor.mount) {
    throw new HtmlDomMappingGapError(message);
  }
  return descriptor.mount.dom;
}

/**
 * Clamps one numeric offset to an inclusive range.
 *
 * @param value - Offset to clamp.
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound.
 * @returns Clamped offset.
 */
export function clampHtmlDomOffset(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
