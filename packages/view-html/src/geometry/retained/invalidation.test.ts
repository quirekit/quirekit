import { describe, expect, it, vi } from "vitest";
import { HtmlFlowGeometryInvalidation } from "./invalidation";

/** @returns Observable dependencies without browser layout, for lifecycle-only tests. */
function fixture() {
  const records: MutationRecord[] = [];
  const disconnect = vi.fn();
  let publish: MutationCallback;
  const Observer = class {
    /** @param callback - Browser's asynchronous mutation delivery. */
    constructor(callback: MutationCallback) { publish = callback; }
    observe = vi.fn();
    disconnect = disconnect;
    /** @returns Pending records synchronously consumed before layout. */
    takeRecords() { return records.splice(0); }
  };
  const document = Object.assign(new EventTarget(), { head: {}, fonts: new EventTarget(), defaultView: { MutationObserver: Observer } });
  const attributes = new Map<string, string>();
  const ancestor = { ownerDocument: document, parentElement: null, getAttribute: (name: string) => attributes.get(name) ?? null } as unknown as HTMLElement;
  const root = { ownerDocument: document, parentElement: ancestor } as unknown as HTMLElement;
  const runtime = new HtmlFlowGeometryInvalidation(root);
  /** @param name - Attribute whose value changes. @param value - New value. Enqueues a real old-value record. */
  const change = (name: string, value: string): void => {
    records.push({ type: "attributes", target: ancestor, attributeName: name, oldValue: attributes.get(name) ?? null } as unknown as MutationRecord);
    attributes.set(name, value);
  };
  return { runtime, document, ancestor, attributes, records, change, disconnect,
    /** Delivers pending records as a browser microtask would. */
    deliver: () => publish(records.splice(0), {} as MutationObserver) };
}

describe("HTML geometry dependency lifecycle", () => {
  it("coalesces restored/no-op attributes but detects current ancestor and stylesheet changes", () => {
    const f = fixture();
    f.attributes.set("class", "original");
    f.change("class", "temporary"); f.change("class", "original");
    expect(f.runtime.consume()).toBe(false);
    f.change("class", "different");
    expect(f.runtime.consume()).toBe(true);
    expect(f.runtime.consume()).toBe(false);
    f.records.push({ type: "childList", target: f.document.head } as unknown as MutationRecord);
    f.deliver();
    expect(f.runtime.consume()).toBe(true);
    f.runtime.destroy();
  });
  it("accepts only the authorized surface style while retaining other invalidations", () => {
    const f = fixture();
    f.change("style", "min-height: 400px");
    f.runtime.acceptSurfaceSize(f.ancestor);
    expect(f.runtime.consume()).toBe(false);
    f.change("style", "min-height: 500px"); f.change("class", "external");
    f.runtime.acceptSurfaceSize(f.ancestor);
    expect(f.runtime.consume()).toBe(true);
    f.change("style", "color: red");
    expect(f.runtime.consume()).toBe(true);
    f.runtime.destroy();
  });
  it("keeps shared input modality separate from unknown ancestor attributes", () => {
    const f = fixture();
    f.change("data-qk-modality", "pointer");
    expect(f.runtime.consume()).toBe(false);
    expect(f.runtime.consumeInteraction()).toBe(true);
    f.change("data-host-layout", "wide");
    expect(f.runtime.consume()).toBe(true);
    f.runtime.destroy();
  });
  it("keeps admission when interactions have no possible layout rule", () => {
    const f = fixture();
    f.runtime.setInteractionLayoutDependency(false);
    f.document.dispatchEvent(new Event("focusin"));
    f.change("data-qk-modality", "pointer");
    expect(f.runtime.consume()).toBe(false);
    expect(f.runtime.consumeInteraction()).toBe(false);
    f.change("class", "new-theme");
    expect(f.runtime.consume()).toBe(true);
    f.runtime.destroy();
  });
  it("observes font and interactive CSS dependencies and releases them on destroy", () => {
    const f = fixture();
    for (const event of ["pointerover", "pointerup", "focusin"]) {
      f.document.dispatchEvent(new Event(event));
      expect(f.runtime.consume()).toBe(false);
      expect(f.runtime.consumeInteraction()).toBe(true);
      expect(f.runtime.consumeInteraction()).toBe(false);
    }
    f.document.fonts.dispatchEvent(new Event("loadingdone"));
    expect(f.runtime.consume()).toBe(true);
    f.runtime.destroy(); f.runtime.destroy();
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    f.document.dispatchEvent(new Event("focusout"));
    f.document.fonts.dispatchEvent(new Event("loading"));
    expect(f.runtime.consume()).toBe(false);
    expect(f.runtime.consumeInteraction()).toBe(false);
  });
});
