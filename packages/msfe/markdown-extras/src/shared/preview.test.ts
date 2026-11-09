// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskScope, type ComponentViewRenderer } from "@quirekit/msfe-core";
import { previewRenderer } from "./preview";
import type { PreviewControlProps, PreviewProps } from "./types";

const dispose: (() => void)[] = [];
afterEach(() => { for (const cleanup of dispose.splice(0)) cleanup(); });

/** @param text - Exact diagram body. @returns Source-bound preview inputs with a separately owned editing target. */
function props(text = "digraph { a -> b }"): PreviewProps {
  return { kind: "textDiagram", language: "dot", text, source: `\`\`\`dot\n${text}\n\`\`\``, range: { from: 0, to: text.length + 11 }, readOnly: false,
    target: () => ({ reveal: () => true, release: vi.fn() }) };
}

/** @param renderer - Retained component factory. @param input - Original canonical body. @returns Mounted output and its real cancellable scope. */
function mount(renderer: ComponentViewRenderer<PreviewProps>, input = props()) {
  const dom = document.createElement("div"), scope = new TaskScope(), measure = vi.fn(); document.body.append(dom);
  const view = renderer({ dom, props: input, scope, host: undefined, requestMeasure: measure });
  dispose.push(() => { view.destroy(); scope.dispose(); dom.remove(); });
  return { dom, scope, view, output: dom.querySelector<HTMLElement>(".msfe-preview")!, measure };
}

describe("asynchronous source preview presentation", () => {
  it("keeps a pending diagram free of raw fences across permission-only updates", async () => {
    let finish!: (html: string) => void;
    const load = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const input = props(), f = mount(previewRenderer(load, undefined, { loadingSource: false }), input);
    expect(f.output.textContent).toBe(""); expect(f.output.dataset.status).toBe("loading");
    expect(f.output.getAttribute("aria-busy")).toBe("true");
    f.view.update({ ...input, readOnly: true }); expect(f.output.textContent).toBe("");
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    finish("<svg><text>diagram</text></svg>"); await vi.waitFor(() => expect(f.output.dataset.status).toBe("ready"));
    expect(f.output.textContent).toBe("diagram"); expect(f.output.getAttribute("aria-busy")).toBe("false");
  });

  it("hydrates an exact cached diagram synchronously without starting a renderer", async () => {
    const load = vi.fn(async () => "<svg/>"), input = props();
    const cache = { get: vi.fn(() => "<svg><text>saved diagram</text></svg>"), set: vi.fn() };
    const f = mount(previewRenderer(load, undefined, { loadingSource: false, cache }), input);
    expect(f.output.querySelector("svg")).not.toBeNull(); expect(f.output.dataset.status).toBe("ready");
    expect(cache.get.mock.calls[0]?.slice(0, 2)).toEqual([input, document]);
    await Promise.resolve(); await Promise.resolve(); expect(load).not.toHaveBeenCalled();
  });

  it("caches only accepted successful output and rejects a cancelled late render", async () => {
    const finishes: ((html: string) => void)[] = [], cache = { get: () => undefined, set: vi.fn() };
    const f = mount(previewRenderer(() => new Promise<string>(resolve => finishes.push(resolve)), undefined, { loadingSource: false, cache }));
    await vi.waitFor(() => expect(finishes).toHaveLength(1));
    const next = props("digraph { b -> c }"); f.view.update(next);
    await vi.waitFor(() => expect(finishes).toHaveLength(2));
    finishes[0]!("<svg><text>old</text></svg>"); await Promise.resolve(); await Promise.resolve();
    expect(cache.set).not.toHaveBeenCalled(); expect(f.output.textContent).toBe("");
    finishes[1]!("<svg><text>new</text></svg>"); await vi.waitFor(() => expect(f.output.dataset.status).toBe("ready"));
    expect(cache.set).toHaveBeenCalledExactlyOnceWith(next, document, "<svg><text>new</text></svg>", expect.objectContaining({ fontSize: expect.any(Number) }));
    expect(f.output.textContent).toBe("new");
  });

  it("retains complete source on error and the default source policy for ordinary previews", async () => {
    const cache = { get: () => undefined, set: vi.fn() }, input = props();
    const failed = mount(previewRenderer(async () => { throw new Error("invalid diagram"); }, undefined, { loadingSource: false, cache }), input);
    await vi.waitFor(() => expect(failed.output.dataset.status).toBe("error"));
    expect(failed.output.textContent).toBe(input.source); expect(cache.set).not.toHaveBeenCalled();
    failed.view.update({ ...input, readOnly: true }); expect(failed.output.textContent).toBe(input.source);
    const ordinary = mount(previewRenderer(() => new Promise<string>(() => {})), input);
    expect(ordinary.output.textContent).toBe(input.source);
  });

  it("allows the source action to retry a failure without caching error text", async () => {
    let action!: PreviewControlProps;
    const controls: ComponentViewRenderer<PreviewControlProps> = mount => {
      action = mount.props;
      return {
        /** @param next - Current asynchronous state and source actions. */
        update(next) { action = next; }, destroy() {},
      };
    };
    const load = vi.fn().mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce("<svg><text>recovered</text></svg>");
    const cache = { get: () => undefined, set: vi.fn() };
    const f = mount(previewRenderer(load, controls, { loadingSource: false, cache }));
    await vi.waitFor(() => expect(action.status).toBe("error")); expect(cache.set).not.toHaveBeenCalled();
    action.retry(); expect(f.output.textContent).toBe(""); expect(action.status).toBe("loading");
    await vi.waitFor(() => expect(action.status).toBe("ready"));
    expect(f.output.textContent).toBe("recovered"); expect(load).toHaveBeenCalledTimes(2); expect(cache.set).toHaveBeenCalledOnce();
  });

  it("leaves single clicks to the host when block previews activate on double-click", async () => {
    const reveal = vi.fn(() => true), input = { ...props(), target: () => ({ reveal, release: vi.fn() }) };
    const press = (output: HTMLElement, type: string) => output.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: 4, clientY: 4 }));
    const host = mount(previewRenderer(async () => "<svg/>", undefined, { activation: "dblclick" }), input);
    expect(host.output.dataset.msfePreview).toBe("textDiagram");
    press(host.output, "pointerdown"); press(host.output, "click"); expect(reveal).not.toHaveBeenCalled();
    press(host.output, "pointerdown"); press(host.output, "dblclick"); expect(reveal).toHaveBeenCalledOnce();
    host.output.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); expect(reveal).toHaveBeenCalledTimes(2);

    const inline = mount(previewRenderer(async () => "<span/>", undefined, { activation: "dblclick" }), { ...input, kind: "inlineMath" });
    press(inline.output, "pointerdown"); press(inline.output, "click"); expect(reveal).toHaveBeenCalledTimes(3);
  });
});
