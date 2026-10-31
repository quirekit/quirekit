// @vitest-environment happy-dom

import { createApp, h, nextTick } from "vue";
import { describe, expect, it } from "vitest";
import type { AiChatReview } from "../types";
import DocumentReview from "./document-review.vue";

/**
 * @param state - Review state.
 * @param diagnostics - Whether developer differences are shown.
 * @param onLocate - Receives located changes; omitted leaves the list static.
 * @returns Mounted card host and teardown.
 */
async function mountReview(state: AiChatReview["state"], diagnostics = false, onLocate?: (change: unknown) => void) {
  const review = {
    messageId: "m", state,
    preview: {
      id: "p", operationId: "o", documentId: "d", capabilityId: "c", target: { kind: "document-blocks", id: "d" },
      sourceDocumentRevision: "r", sourceDocument: { type: "doc" }, candidateDocument: { type: "doc" },
      sourceText: "核心指标全部达成", candidateText: "核心指标基本达成", formatOnly: false,
      sourceView: "核心指标全部达成", candidateView: "核心指标基本达成",
      changes: [
        { kind: "edited", excerpt: "核心指标全部达成", formats: [], text: [
          { kind: "same", text: "核心指标" }, { kind: "removed", text: "全部" }, { kind: "inserted", text: "基本" }, { kind: "same", text: "达成" }
        ] },
        { kind: "edited", excerpt: "1.5 倍行距", formats: [{ label: "对齐", before: "居中", after: null, toggle: false }],
          source: { from: 40, to: 60 }, candidate: { from: 40, to: 60 } },
        { kind: "edited", section: "文档设置", excerpt: "页面", formats: [], text: [{ kind: "same", text: "页面：A4" }] }
      ]
    }
  } as unknown as AiChatReview;
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(DocumentReview, { review, locale: "zh-CN", diagnostics, ...(onLocate === undefined ? {} : { locatable: true, onLocate }) }) });
  app.mount(host);
  await nextTick();
  return { host, unmount: () => { app.unmount(); host.remove(); } };
}

describe("document review card", () => {
  it("lists the changes in people's terms without diff chrome", async () => {
    const mounted = await mountReview("pending");
    const text = mounted.host.textContent ?? "";
    expect(text).toContain("3 处修改");
    expect(mounted.host.querySelector("del")?.textContent).toBe("全部");
    expect(mounted.host.querySelector("ins")?.textContent).toBe("基本");
    expect(text).toContain("取消对齐（原为居中）");
    expect(text).not.toContain("@@");
    expect(text).not.toContain("开发者");
    mounted.unmount();
  });

  it("folds the list once decided and offers raw differences only to developers", async () => {
    const decided = await mountReview("approved");
    expect(decided.host.textContent).toContain("查看修改");
    const trigger = [...decided.host.querySelectorAll("button")].find(button => button.textContent?.includes("查看修改"));
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    decided.unmount();
    const developer = await mountReview("pending", true);
    expect(developer.host.textContent).toContain("开发者：原始差异");
    developer.unmount();
  });

  it("asks the host to show a change when one is clicked", async () => {
    const located: unknown[] = [];
    const mounted = await mountReview("pending", false, change => located.push(change));
    mounted.host.querySelectorAll<HTMLButtonElement>(".qk-ai-review__entry")[1]?.click();
    expect(located).toMatchObject([{ excerpt: "1.5 倍行距" }]);
    expect(mounted.host.querySelectorAll("button.qk-ai-review__entry")).toHaveLength(1);
    mounted.unmount();
    const fixed = await mountReview("pending");
    expect(fixed.host.querySelector("button.qk-ai-review__entry")).toBeNull();
    fixed.unmount();
  });

  it("shows a redrawn picture as images before and after, and releases them", async () => {
    const review = {
      messageId: "m", state: "pending",
      preview: { id: "p", sourceText: "", candidateText: "", changes: [{
        kind: "edited", excerpt: "[流程图「系统架构」]", formats: [],
        objects: [{ kind: "edited", label: "流程图「系统架构」", before: { source: "old" }, after: { source: "new" } }]
      }] }
    } as unknown as AiChatReview;
    const released: string[] = [];
    const resolveImage = async (source: unknown) => ({ url: `blob:${String(source)}`, release: () => released.push(String(source)) });
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({ render: () => h(DocumentReview, { review, locale: "zh-CN", resolveImage }) });
    app.mount(host);
    await new Promise(resolve => setTimeout(resolve, 0));
    await nextTick();
    expect([...host.querySelectorAll(".qk-ai-review__figure img")].map(image => image.getAttribute("src"))).toEqual(["blob:old", "blob:new"]);
    expect([...host.querySelectorAll(".qk-ai-review__caption")].map(caption => caption.textContent)).toEqual(["修改前", "修改后"]);
    // Images sit beside the change entry, not inside its locate button.
    expect(host.querySelector(".qk-ai-review__entry .qk-ai-review__figure")).toBeNull();
    // One preview holds both images, so it moves from before to after.
    host.querySelector<HTMLButtonElement>('button[aria-label="查看流程图「系统架构」 · 修改前"]')!.click();
    await nextTick();
    await nextTick();
    const preview = document.body.textContent ?? "";
    expect(preview).toContain("流程图「系统架构」 · 修改前");
    expect(preview).toMatch(/1\s*\/\s*2/u);
    app.unmount();
    host.remove();
    expect(released.sort()).toEqual(["new", "old"]);
  });
});
