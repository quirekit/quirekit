import { describe, expect, it } from "vitest";
import { createTestDocument } from "../testing/fixtures";
import { createQuireAiPiReplyPresenter } from "./reply";

describe("streamed reply presentation", () => {
  it("holds a block reference split across parts until it is complete", () => {
    const { document } = createTestDocument();
    const presented: string[] = [];
    const languages: string[] = [];
    const reply = createQuireAiPiReplyPresenter({ ...document, presentReply: (text, language) => {
      languages.push(language ?? "");
      return text.replace(/\[?\bb(\d+)\]?/gu, "第 $1 段");
    } }, text => presented.push(text));
    for (const part of ["请看 b", "1 和 [b", "12]，以及 b3", " 到 b", "4。"]) reply.push(part);
    reply.flush();
    expect(presented.join("")).toBe("请看 第 1 段 和 第 12 段，以及 第 3 段 到 第 4 段。");
    expect(new Set(languages)).toEqual(new Set(["zh"]));
  });

  it("holds a comment reference split across parts", () => {
    const { document } = createTestDocument();
    const presented: string[] = [];
    const reply = createQuireAiPiReplyPresenter({ ...document, presentReply: text => text.replace(/\bc(\d+)\b/gu, "批注$1") }, text => presented.push(text));
    for (const part of ["我来回复（c", "4），然后解决它。"]) reply.push(part);
    reply.flush();
    expect(presented.join("")).toBe("我来回复（批注4），然后解决它。");
  });

  it("delivers held text at the end of a message", () => {
    const { document } = createTestDocument();
    const presented: string[] = [];
    const reply = createQuireAiPiReplyPresenter({ ...document, presentReply: text => text.toUpperCase() }, text => presented.push(text));
    reply.push("see b");
    expect(presented).toEqual(["SEE "]);
    reply.flush();
    expect(presented).toEqual(["SEE ", "B"]);
  });
});
