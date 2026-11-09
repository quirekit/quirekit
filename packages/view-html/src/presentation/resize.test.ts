import { describe, expect, it, vi } from "vitest";
import { bindHtmlResizeEvents } from "./resize";

describe("HTML resize source authority", () => {
  it("distinguishes passive element echoes from media-query invalidation and cleans up once", () => {
    let notify: ResizeObserverCallback;
    const observe = vi.fn(), disconnect = vi.fn(), resized = vi.fn();
    const window = Object.assign(new EventTarget(), { ResizeObserver: class {
      /** @param callback - Browser element-size notification. */
      constructor(callback: ResizeObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    } });
    const root = { ownerDocument: { defaultView: window } } as unknown as HTMLElement;
    const surface = {} as HTMLElement;
    const cleanup = bindHtmlResizeEvents(root, surface, resized);
    expect(observe).toHaveBeenCalledWith(surface);
    notify!([], {} as ResizeObserver);
    window.dispatchEvent(new Event("resize"));
    expect(resized.mock.calls).toEqual([[true], [false]]);
    cleanup(); cleanup();
    window.dispatchEvent(new Event("resize"));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(resized).toHaveBeenCalledTimes(2);
  });
});
