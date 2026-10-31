// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import mermaid from "mermaid";
import { renderMermaid } from "./mermaid";

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));
afterEach(() => { vi.resetAllMocks(); document.body.replaceChildren(); });

const typography = { fontFamily: "Arial", fontSize: 16 };

it("measures in a connected hidden container and releases it after rendering", async () => {
  let measured: Element | undefined;
  vi.mocked(mermaid.render).mockImplementationOnce(async (_id, _text, container) => {
    measured = container;
    expect(container?.parentElement).toBe(document.body);
    expect(container?.getAttribute("aria-hidden")).toBe("true");
    expect((container as HTMLElement).style.position).toBe("fixed");
    expect((container as HTMLElement).style.visibility).toBe("hidden");
    expect((container as HTMLElement).style.overflow).toBe("hidden");
    return { svg: "<svg />", diagramType: "flowchart" };
  });
  await expect(renderMermaid("flowchart LR; A --> B", new AbortController().signal, typography)).resolves.toBe("<svg />");
  expect(measured?.isConnected).toBe(false);
  expect(document.body.children).toHaveLength(0);
});

it("releases failed measurement DOM and lets the next queued render proceed", async () => {
  vi.mocked(mermaid.render).mockImplementationOnce(async (_id, _text, container) => {
    container?.append(document.createElement("svg"));
    throw new Error("invalid diagram");
  }).mockResolvedValueOnce({ svg: "<svg />", diagramType: "flowchart" });
  const signal = new AbortController().signal;
  await expect(renderMermaid("invalid", signal, typography)).rejects.toThrow("invalid diagram");
  expect(document.body.children).toHaveLength(0);
  await expect(renderMermaid("flowchart LR; A --> B", signal, typography)).resolves.toBe("<svg />");
  expect(document.body.children).toHaveLength(0);
});

it("discards a cancelled result and releases its measurement container", async () => {
  const controller = new AbortController();
  vi.mocked(mermaid.render).mockImplementationOnce(async () => {
    controller.abort(new Error("cancelled"));
    return { svg: "<svg />", diagramType: "flowchart" };
  });
  await expect(renderMermaid("flowchart LR; A --> B", controller.signal, typography)).rejects.toThrow("cancelled");
  expect(document.body.children).toHaveLength(0);
});
