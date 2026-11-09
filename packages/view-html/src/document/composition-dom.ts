import type { QuireImePreedit } from "@quirekit/view-engine";
import {
  createHtmlCompositionDescriptor,
  type HtmlCompositionDesc,
  type HtmlContainerDesc,
  type HtmlDescriptor,
  type HtmlTextDesc
} from "../descriptors";
import { HtmlDomMappingGapError } from "../reconcile/ownership/mapping-gap";
import type {
  AttachHtmlCompositionDomOptions,
  HtmlAttachedComposition,
  HtmlCompositionAnchor,
  HtmlCompositionAttachmentResult,
  HtmlCompositionTextSnapshot,
  HtmlDomPoint
} from "./types";

/**
 * Realizes one transient descriptor while preserving retained owner identities.
 *
 * The canonical text node becomes the prefix and a session-owned suffix keeps
 * unselected text after preedit. The descriptor is intentionally not adopted by
 * the persistent child index: the composition session is its sole authority.
 *
 * @param options - Retained owner, session identity, text, and presentation.
 * @returns Attached session and direct transient DOM write count.
 */
export function attachHtmlCompositionDom(
  options: AttachHtmlCompositionDomOptions
): HtmlCompositionAttachmentResult {
  assertValidCompositionRange(options);
  const point = options.resolveDomPoint(options.preedit.range.from, 1);
  const owner = options.documentView.descriptorById(point.descriptorId);
  const parent = resolveCompositionParent(owner);
  if (!owner || !parent) {
    throw new HtmlDomMappingGapError(
      `Document position ${options.preedit.range.from} has no retained composition owner.`
    );
  }
  const descriptor = createHtmlCompositionDescriptor({
    id: options.descriptorId,
    parent,
    source: owner.source,
    range: options.preedit.range,
    text: options.preedit.text,
    ownerDocument: options.ownerDocument,
    presentation: options.presentation
  });
  try {
    const snapshots = collectTextSnapshots(options, owner);
    const placement = insertCompositionDom(
      point,
      owner,
      descriptor,
      snapshots,
      options.preedit,
      options.ownerDocument
    );
    return {
      session: {
        descriptor,
        preedit: options.preedit,
        snapshots,
        suffixDOM: placement.suffixDOM,
        anchor: placement.anchor
      },
      writes: placement.writes
    };
  } catch (error) {
    descriptor.destroy();
    throw error;
  }
}

/**
 * Restores canonical retained DOM and releases one session-owned descriptor.
 *
 * @param attached - Attached session to restore and destroy.
 * @returns Number of direct transient DOM writes performed during teardown.
 */
export function detachHtmlCompositionDom(
  attached: HtmlAttachedComposition | undefined
): number {
  if (!attached) {
    return 0;
  }
  for (const snapshot of attached.snapshots) {
    if (snapshot.descriptor.mount) {
      snapshot.descriptor.mount.dom.nodeValue = snapshot.value;
    }
  }
  removeDomNode(attached.suffixDOM);
  attached.descriptor.destroy();
  return attached.snapshots.length + 2;
}

/**
 * Carries a canonical text offset across the prefix/suffix split: text after
 * the preedit lives in the suffix, and an offset inside replaced text resolves
 * to where the preedit starts.
 *
 * @param attached - Attached session.
 * @param point - DOM point from retained ownership.
 * @returns Point valid in the composing DOM.
 */
export function projectHtmlCompositionDomPoint<T extends HtmlDomPoint>(attached: HtmlAttachedComposition, point: T): T {
  const { anchor, suffixDOM } = attached;
  if (anchor !== undefined && suffixDOM !== undefined && point.node === anchor.node) {
    if (point.offset <= anchor.start) return point;
    return point.offset < anchor.end ? { ...point, offset: anchor.start } : { ...point, node: suffixDOM, offset: point.offset - anchor.end };
  }
  // Other text nodes the preedit replaced are shortened in place.
  const length = point.node.nodeType === 3 ? point.node.nodeValue?.length ?? 0 : Infinity;
  return point.offset <= length ? point : { ...point, offset: length };
}

/**
 * Rejects stale or inverted canonical ranges before DOM ownership lookup.
 *
 * @param options - Attachment request whose range must belong to the document.
 */
function assertValidCompositionRange(options: AttachHtmlCompositionDomOptions): void {
  const { from, to } = options.preedit.range;
  const documentRange = options.documentView.root.range;
  if (from < documentRange.from || to < from || to > documentRange.to) {
    throw new RangeError(
      `Range ${from}-${to} is outside retained document ${documentRange.from}-${documentRange.to}.`
    );
  }
}

/**
 * Resolves the retained container whose inherited DOM flow hosts composition.
 *
 * @param owner - Descriptor owning the canonical insertion point.
 * @returns Nearest retained container, or undefined for an invalid owner chain.
 */
function resolveCompositionParent(
  owner: HtmlDescriptor | undefined
): HtmlContainerDesc | undefined {
  if (!owner) {
    return undefined;
  }
  if (
    owner.kind === "document" || owner.kind === "node" ||
    owner.kind === "mark" || owner.kind === "inline-decoration" || owner.kind === "node-view"
  ) {
    return owner;
  }
  return owner.parent ?? undefined;
}

/**
 * Collects exact retained text values intersecting the replaced canonical range.
 *
 * @param options - Current document and preedit range.
 * @param owner - Descriptor owning the insertion point.
 * @returns Ordered text snapshots restored on detach.
 */
function collectTextSnapshots(
  options: AttachHtmlCompositionDomOptions,
  owner: HtmlDescriptor
): readonly HtmlCompositionTextSnapshot[] {
  const candidates = options.preedit.range.from === options.preedit.range.to
    ? [owner]
    : options.documentView.descriptorsInRange(options.preedit.range);
  return candidates
    .filter((descriptor): descriptor is HtmlTextDesc => descriptor.kind === "text")
    .map((descriptor) => ({
      descriptor,
      value: descriptor.mount?.dom.nodeValue ?? ""
    }));
}

/**
 * Inserts composition DOM and removes canonical text slices represented by it.
 *
 * @param point - Canonical insertion point.
 * @param owner - Descriptor owning the insertion point.
 * @param descriptor - Transient descriptor to attach.
 * @param snapshots - Exact retained values affected by the preedit.
 * @param preedit - Canonical range and visible text.
 * @param ownerDocument - Browser document used for the transient suffix.
 * @returns Transient suffix and direct write count.
 */
function insertCompositionDom(
  point: HtmlDomPoint,
  owner: HtmlDescriptor,
  descriptor: HtmlCompositionDesc,
  snapshots: readonly HtmlCompositionTextSnapshot[],
  preedit: QuireImePreedit,
  ownerDocument: Document
): { readonly suffixDOM: Text | undefined; readonly anchor: HtmlCompositionAnchor | undefined; readonly writes: number } {
  const compositionDOM = descriptor.mount?.dom;
  if (!compositionDOM) {
    throw new HtmlDomMappingGapError("Composition descriptor has no mounted DOM product.");
  }
  if (owner.kind !== "text") {
    const reference = point.node.childNodes[point.offset] ?? null;
    point.node.insertBefore(compositionDOM, reference as ChildNode | null);
    return { suffixDOM: undefined, anchor: undefined, writes: 1 };
  }
  const anchorSnapshot = snapshots.find((snapshot) => snapshot.descriptor === owner);
  const anchorDOM = owner.mount?.dom;
  const parentDOM = anchorDOM?.parentNode;
  if (!anchorSnapshot || !anchorDOM || !parentDOM) {
    throw new HtmlDomMappingGapError(
      `Text descriptor "${owner.id}" cannot host composition DOM.`
    );
  }

  const anchorStart = preedit.range.from - owner.range.from;
  const anchorEnd = Math.min(preedit.range.to, owner.range.to) - owner.range.from;
  const suffixDOM = ownerDocument.createTextNode(anchorSnapshot.value.slice(anchorEnd));
  anchorDOM.nodeValue = anchorSnapshot.value.slice(0, anchorStart);
  const reference = nextDomSibling(anchorDOM, parentDOM);
  parentDOM.insertBefore(compositionDOM, reference as ChildNode | null);
  parentDOM.insertBefore(suffixDOM, reference as ChildNode | null);

  for (const snapshot of snapshots) {
    if (snapshot.descriptor === owner || !snapshot.descriptor.mount) {
      continue;
    }
    const from = Math.max(preedit.range.from, snapshot.descriptor.range.from) -
      snapshot.descriptor.range.from;
    const to = Math.min(preedit.range.to, snapshot.descriptor.range.to) -
      snapshot.descriptor.range.from;
    snapshot.descriptor.mount.dom.nodeValue =
      snapshot.value.slice(0, from) + snapshot.value.slice(to);
  }
  return { suffixDOM, anchor: { node: anchorDOM, start: anchorStart, end: anchorEnd }, writes: snapshots.length + 2 };
}

/**
 * Reads the next direct sibling in browser and array-backed fake DOMs.
 *
 * @param node - Current direct child.
 * @param parent - Parent whose child order is authoritative.
 * @returns Next direct sibling, or null at the end of the container.
 */
function nextDomSibling(node: Node, parent: Node): Node | null {
  const children = Array.from(parent.childNodes) as Node[];
  const index = children.indexOf(node);
  return index < 0 ? null : children[index + 1] ?? null;
}

/**
 * Removes one session-owned DOM node when present.
 *
 * @param node - Transient node to detach.
 */
function removeDomNode(node: Node | undefined): void {
  if (!node) {
    return;
  }
  const removable = node as Node & { remove?: () => void };
  if (removable.remove) {
    removable.remove();
    return;
  }
  node.parentNode?.removeChild(node);
}
