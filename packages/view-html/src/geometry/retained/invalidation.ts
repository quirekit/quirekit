/** Observed layout-dependency generation owned by one mounted HTML document. */
export class HtmlFlowGeometryInvalidation {
  private observer: MutationObserver | undefined;
  private dirty = false;
  private interactionDirty = false;
  private interactionLayout = true;
  private styleComparison: readonly [CSSStyleDeclaration, CSSStyleDeclaration] | undefined;
  private readonly cleanups: (() => void)[] = [];

  /** @param root - Retained semantic document root and its external style ancestors. */
  constructor(private readonly root: HTMLElement) {
    const document = root.ownerDocument;
    const Observer = document.defaultView?.MutationObserver;
    if (!Observer) return;
    this.observer = new Observer(records => this.inspect(records));
    if (document.head) this.observer.observe(document.head, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true
    });
    for (let element: HTMLElement | null = root; element; element = element.parentElement) {
      this.observer.observe(element, { attributes: true, attributeOldValue: true });
    }
    for (const event of ["pointerover", "pointerout", "pointerdown", "pointerup", "pointercancel", "focusin", "focusout"]) {
      document.addEventListener(event, this.invalidateInteraction, { capture: true });
      this.cleanups.push(() => document.removeEventListener(event, this.invalidateInteraction, { capture: true }));
    }
    for (const event of ["loading", "loadingdone", "loadingerror"]) {
      document.fonts?.addEventListener(event, this.invalidate);
      this.cleanups.push(() => document.fonts?.removeEventListener(event, this.invalidate));
    }
    document.addEventListener("load", this.stylesheetLoaded, { capture: true });
    this.cleanups.push(() => document.removeEventListener("load", this.stylesheetLoaded, { capture: true }));
  }

  /** @returns Whether browser observation can protect incremental content updates. */
  get observable(): boolean { return this.observer !== undefined; }

  /** @returns Whether browser evidence invalidated the previous layout admission. */
  consume(): boolean {
    if (!this.observer) return false;
    this.inspect(this.observer.takeRecords());
    const dirty = this.dirty;
    this.dirty = false;
    return dirty;
  }

  /** @returns Whether the next content update must reestablish flow admission after interactive CSS changes. */
  consumeInteraction(): boolean {
    const dirty = this.interactionDirty;
    this.interactionDirty = false;
    return dirty;
  }

  /** @param possible - Whether the admitted document has a possible interactive layout rule. */
  setInteractionLayoutDependency(possible: boolean): void { this.interactionLayout = possible; }

  /**
   * Excludes only synchronous presentation-owned surface size assignments.
   * @param surface - Content surface just sized from the current measured result.
   */
  acceptSurfaceSize(surface: HTMLElement): void {
    this.inspect((this.observer?.takeRecords() ?? []).filter(record =>
      record.target !== surface || record.type !== "attributes" || record.attributeName !== "style"));
  }

  /** Releases browser observers and event listeners. */
  destroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
  }

  /** Marks geometry dependencies as changed without reading layout. */
  private readonly invalidate = (): void => { this.dirty = true; };

  /** Revokes text-flow admission without adding full measurement to existing selection-only gestures. */
  private readonly invalidateInteraction = (): void => { if (this.interactionLayout) this.interactionDirty = true; };

  /** @param event - Resource completion; stylesheet rules may arrive after the link's DOM mutation. */
  private readonly stylesheetLoaded = (event: Event): void => {
    if ((event.target as Element | null)?.tagName === "LINK") this.dirty = true;
  };

  /** @param records - Synchronously drained or asynchronously delivered layout-related mutations. */
  private inspect(records: readonly MutationRecord[]): void {
    const seen = new Map<Node, Set<string>>();
    for (const record of records) {
      // Reassigning an unchanged surface style is an owned no-op, not evidence
      // that CSS changed. Head text/child changes always invalidate admission.
      if (record.type === "attributes" && record.attributeName) {
        let names = seen.get(record.target);
        if (!names) { names = new Set(); seen.set(record.target, names); }
        if (names.has(record.attributeName)) continue;
        names.add(record.attributeName);
        if ((record.target as Element).getAttribute(record.attributeName) === record.oldValue) continue;
        // Cursor and shared UI focus-ring modality do not own document layout.
        // Revoke admission for the next text edit, preserving selection reuse.
        if (record.attributeName === "data-qk-modality" || this.cursorOnlyChanged(record)) {
          this.invalidateInteraction();
          continue;
        }
      }
      this.dirty = true;
    }
  }

  /** @param record - First style record before an observed batch. @returns Whether only cursor presentation changed. */
  private cursorOnlyChanged(record: MutationRecord): boolean {
    const document = this.root.ownerDocument;
    if (record.attributeName !== "style" || !document.createElement) return false;
    this.styleComparison ??= [document.createElement("span").style, document.createElement("span").style];
    const [before, after] = this.styleComparison;
    if (!before.removeProperty || !after.removeProperty) return false;
    before.cssText = record.oldValue ?? "";
    after.cssText = (record.target as Element).getAttribute("style") ?? "";
    before.removeProperty("cursor"); after.removeProperty("cursor");
    return before.cssText === after.cssText;
  }
}
