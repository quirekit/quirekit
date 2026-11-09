import type { Mapping } from "@quirekit/pm";
import type { QuireImePreedit } from "@quirekit/view-engine";
import type {
  HtmlCompositionDesc,
  HtmlCompositionPresentation
} from "../descriptors";
import { HtmlDomMappingGapError } from "../reconcile/ownership/mapping-gap";
import type { HtmlMeasuredClientRect } from "../measurement/types";
import type {
  CreateHtmlDocumentCompositionRuntimeOptions,
  HtmlAttachedComposition,
  HtmlCompositionSyncResult,
  HtmlDocumentCompositionDiagnostics,
  HtmlDocumentCompositionRuntime,
  HtmlDomPoint
} from "./types";
import {
  attachHtmlCompositionDom,
  detachHtmlCompositionDom,
  projectHtmlCompositionDomPoint
} from "./composition-dom";

/**
 * Creates the session runtime that realizes IME preedit inside retained DOM flow.
 *
 * @param options - Retained document, browser document, and provenance inputs.
 * @returns Composition runtime with explicit attach, mapping, and teardown phases.
 */
export function createHtmlDocumentCompositionRuntime(
  options: CreateHtmlDocumentCompositionRuntimeOptions
): HtmlDocumentCompositionRuntime {
  return new HtmlDocumentCompositionRuntimeImpl(options);
}

/** Internal retained document composition implementation. */
class HtmlDocumentCompositionRuntimeImpl
  implements HtmlDocumentCompositionRuntime {
  private readonly documentView: CreateHtmlDocumentCompositionRuntimeOptions["documentView"];
  private readonly resolveDomPoint: CreateHtmlDocumentCompositionRuntimeOptions["resolveDomPoint"];
  private readonly ownerDocument: Document;
  private readonly rootId: string;
  private readonly regionId: string;
  private readonly onGap: ((message: string) => void) | undefined;
  private attached: HtmlAttachedComposition | undefined;
  private gaps = 0;
  private nextSessionId = 0;
  private destroyed = false;

  /** @inheritdoc */
  get descriptor(): HtmlCompositionDesc | undefined {
    return this.attached?.descriptor;
  }

  /**
   * Creates one retained document composition runtime.
   *
   * @param options - Retained document, browser document, and provenance inputs.
   */
  constructor(options: CreateHtmlDocumentCompositionRuntimeOptions) {
    this.documentView = options.documentView;
    this.resolveDomPoint = options.resolveDomPoint;
    this.ownerDocument = options.ownerDocument;
    this.rootId = options.rootId;
    this.regionId = options.regionId;
    this.onGap = options.onGap;
  }

  /** @inheritdoc */
  sync(
    preedit: QuireImePreedit | undefined,
    presentation: HtmlCompositionPresentation
  ): HtmlCompositionSyncResult {
    this.assertActive();
    if (!preedit) {
      return { active: false, writes: this.detach() };
    }
    if (this.attached && sameRange(this.attached.preedit, preedit)) {
      this.attached.descriptor.update(preedit.range, preedit.text, presentation);
      this.attached = { ...this.attached, preedit };
      return { active: true, writes: 1 };
    }

    let writes = this.detach();
    try {
      const attached = attachHtmlCompositionDom({
        documentView: this.documentView,
        resolveDomPoint: this.resolveDomPoint,
        ownerDocument: this.ownerDocument,
        descriptorId: `${this.rootId}:composition:${++this.nextSessionId}`,
        preedit,
        presentation
      });
      this.attached = attached.session;
      writes += attached.writes;
      return { active: true, writes };
    } catch (error) {
      if (!(error instanceof HtmlDomMappingGapError) && !(error instanceof RangeError)) {
        throw error;
      }
      this.reportGap(
        `Cannot attach HTML composition at ${preedit.range.from}-${preedit.range.to}: ${error.message}`
      );
      return { active: false, writes };
    }
  }

  /** @inheritdoc */
  prepareDocumentUpdate(
    mapping: Mapping,
    preserve: boolean
  ): QuireImePreedit | undefined {
    this.assertActive();
    const preedit = this.attached?.preedit;
    this.detach();
    if (!preedit || !preserve) {
      return undefined;
    }
    const collapsed = preedit.range.from === preedit.range.to;
    const mappedFrom = mapping.mapResult(preedit.range.from, 1);
    const mappedTo = collapsed
      ? mappedFrom
      : mapping.mapResult(preedit.range.to, -1);
    if (mappedFrom.deletedAcross || mappedTo.deletedAcross) {
      this.reportGap(
        `HTML composition range ${preedit.range.from}-${preedit.range.to} was deleted across a document update.`
      );
      return undefined;
    }
    return {
      range: { from: mappedFrom.pos, to: mappedTo.pos },
      text: preedit.text
    };
  }

  /** @inheritdoc */
  projectDomPoint<T extends HtmlDomPoint>(point: T): T {
    return this.attached === undefined ? point : projectHtmlCompositionDomPoint(this.attached, point);
  }

  /** @inheritdoc */
  inputAnchor(): HtmlMeasuredClientRect | undefined {
    const descriptor = this.attached?.descriptor;
    if (!descriptor) {
      return undefined;
    }
    const range = this.ownerDocument.createRange();
    range.setStart(descriptor.textDOM, descriptor.textDOM.nodeValue?.length ?? 0);
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      descriptorId: descriptor.id,
      source: descriptor.source,
      rootId: this.rootId,
      regionId: this.regionId
    };
  }

  /** @inheritdoc */
  getDiagnostics(): HtmlDocumentCompositionDiagnostics {
    return { gaps: this.gaps };
  }

  /** @inheritdoc */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.detach();
    this.destroyed = true;
  }

  /**
   * Restores canonical retained DOM and destroys the session-owned descriptor.
   *
   * @returns Number of direct DOM writes performed during teardown.
   */
  private detach(): number {
    const attached = this.attached;
    if (!attached) {
      return 0;
    }
    this.attached = undefined;
    return detachHtmlCompositionDom(attached);
  }

  /**
   * Records one explicit ownership/mapping gap without inventing a fallback.
   *
   * @param message - Stable human-readable gap detail.
   */
  private reportGap(message: string): void {
    this.gaps += 1;
    this.onGap?.(message);
  }

  /** Throws after lifecycle release. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new RangeError("Retained HTML composition runtime has been destroyed.");
    }
  }
}

/**
 * Compares only the canonical replacement range of two preedit updates.
 *
 * @param left - Currently attached preedit.
 * @param right - Incoming preedit update.
 * @returns Whether the stable descriptor can be patched in place.
 */
function sameRange(left: QuireImePreedit, right: QuireImePreedit): boolean {
  return left.range.from === right.range.from && left.range.to === right.range.to;
}
