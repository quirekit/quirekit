import type { QuireChangedRange } from "@quirekit/core";
import type { Mapping } from "@quirekit/pm";
import type { QuireDocumentRange } from "@quirekit/renderer";
import type {
  HtmlContainerDesc,
  HtmlDescriptor,
  HtmlDocumentDesc
} from "../descriptors";
import type { HtmlMappedDescriptorResult } from "./types";
import { htmlDescriptorContentRange, isHtmlContainerDescriptor } from "./ownership/descriptor-tree";
import {
  mapHtmlInlineRange,
  mapHtmlOuterRange,
  mapHtmlWidgetRange
} from "./mapping/range";

/** Inputs for mapping retained descriptor ranges and deriving dirty parents. */
interface MapHtmlDescriptorOptions {
  /** Immortal retained document root. */
  readonly root: HtmlDocumentDesc;
  /** Mapping from the previous document to the next document. */
  readonly mapping: Mapping;
  /** Next document content size. */
  readonly documentSize: number;
  /** Typed changed ranges in old and next document coordinates. */
  readonly changedRanges: readonly QuireChangedRange[];
}

/**
 * Maps retained ranges and selects the smallest parent-bounded dirty containers.
 *
 * @param options - Existing root, transaction mapping, and changed ranges.
 * @returns Dirty containers and descriptors whose ownership was deleted.
 */
export function mapHtmlDescriptorTree(
  options: MapHtmlDescriptorOptions
): HtmlMappedDescriptorResult {
  const invalidDescriptors = new Set<HtmlDescriptor>();
  const dirtyContainers = new Set<HtmlContainerDesc>();
  const mandatoryContainers = new Set<HtmlContainerDesc>();

  // Map ownership before interpreting changed ranges so dirty scopes are
  // selected in next-document coordinates and deleted boundaries stay explicit.
  options.root.range = { from: 0, to: options.documentSize };
  options.root.setDirtyState("mapped");
  for (const child of options.root.children) {
    mapDescriptor(
      child,
      options.mapping,
      invalidDescriptors,
      dirtyContainers,
      mandatoryContainers
    );
  }

  for (const change of options.changedRanges) {
    dirtyContainers.add(findSmallestDirtyContainer(options.root, change.newRange));
  }

  return {
    dirtyContainers: selectDirtyContainers(dirtyContainers, mandatoryContainers),
    invalidDescriptors
  };
}

/**
 * Maps one descriptor and its descendants according to its ownership kind.
 *
 * @param descriptor - Descriptor whose previous range is mapped.
 * @param mapping - Transaction mapping to the next document.
 * @param invalidDescriptors - Mutable invalid ownership output.
 * @param dirtyContainers - Mutable dirty parent output.
 * @param mandatoryContainers - Parents that must reconcile invalid children.
 */
function mapDescriptor(
  descriptor: HtmlDescriptor,
  mapping: Mapping,
  invalidDescriptors: Set<HtmlDescriptor>,
  dirtyContainers: Set<HtmlContainerDesc>,
  mandatoryContainers: Set<HtmlContainerDesc>
): void {
  const previousRange = descriptor.range;
  const mapped = descriptor.kind === "widget"
    ? mapHtmlWidgetRange(previousRange, mapping, descriptor.side)
    : descriptor.kind === "text" || descriptor.kind === "mark" || descriptor.kind === "inline-decoration"
      ? mapHtmlInlineRange(previousRange, mapping)
      : mapHtmlOuterRange(previousRange, mapping);

  descriptor.range = mapped.range;
  if (mapped.invalid) {
    descriptor.setDirtyState("invalid");
    invalidDescriptors.add(descriptor);
    if (descriptor.parent) {
      if (descriptor.parent.dirtyState !== "invalid") {
        descriptor.parent.setDirtyState("dirty");
      }
      dirtyContainers.add(descriptor.parent);
      mandatoryContainers.add(descriptor.parent);
    }
  } else {
    descriptor.setDirtyState("mapped");
    if (previousRange.from !== mapped.range.from || previousRange.to !== mapped.range.to) {
      descriptor.geometryEpoch += 1;
    }
  }

  if (isHtmlContainerDescriptor(descriptor)) {
    for (const child of descriptor.children) {
      mapDescriptor(
        child,
        mapping,
        invalidDescriptors,
        dirtyContainers,
        mandatoryContainers
      );
    }
  }
}

/**
 * Finds the deepest mounted container whose content owns a changed range.
 *
 * @param container - Current parent-bounded search root.
 * @param range - Changed range in next-document coordinates.
 * @returns Smallest retained container that owns the range.
 */
function findSmallestDirtyContainer(
  container: HtmlContainerDesc,
  range: QuireDocumentRange
): HtmlContainerDesc {
  for (const child of container.children) {
    if (!isHtmlContainerDescriptor(child) || child.dirtyState === "invalid") {
      continue;
    }
    const contentRange = htmlDescriptorContentRange(child);
    // A collapsed deletion at an inline boundary can have changed the adjacent
    // run. Its shared parent owns reconciliation of both sides of that boundary.
    const inlineWrapper = child.kind === "mark" || child.kind === "inline-decoration";
    if (inlineWrapper && (range.from === contentRange.from || range.to === contentRange.to)) {
      continue;
    }
    if (contentRange.from <= range.from && range.to <= contentRange.to) {
      return findSmallestDirtyContainer(child, range);
    }
  }
  container.setDirtyState("dirty");
  return container;
}

/**
 * Selects minimal dirty scopes without hiding invalid direct-child ownership.
 *
 * @param containers - Candidate dirty containers.
 * @param mandatoryContainers - Parents required to process invalid children.
 * @returns Parent-bounded dirty roots in document order.
 */
function selectDirtyContainers(
  containers: ReadonlySet<HtmlContainerDesc>,
  mandatoryContainers: ReadonlySet<HtmlContainerDesc>
): HtmlContainerDesc[] {
  const candidates = [...containers].filter((candidate) => (
    ![...mandatoryContainers].some((mandatory) => (
      mandatory !== candidate && isAncestor(mandatory, candidate)
    ))
  ));

  return candidates.filter((candidate) => (
    mandatoryContainers.has(candidate) ||
    !candidates.some((other) => other !== candidate && isAncestor(candidate, other))
  )).sort((left, right) => left.range.from - right.range.from);
}

/**
 * Checks whether one retained container is an ancestor of another.
 *
 * @param ancestor - Possible ancestor descriptor.
 * @param descendant - Possible retained descendant.
 * @returns Whether the descendant is owned below the ancestor.
 */
function isAncestor(ancestor: HtmlContainerDesc, descendant: HtmlContainerDesc): boolean {
  for (let parent = descendant.parent; parent; parent = parent.parent) {
    if (parent === ancestor) {
      return true;
    }
  }
  return false;
}
