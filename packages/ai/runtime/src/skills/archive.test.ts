import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { readQuireAiSkillArchive, readQuireAiSkillMarkdown, writeQuireAiSkillArchive } from "./archive";
import { createQuireAiSkillLibrary } from "./library";
import { readQuireAiSkillFrontMatter } from "./markdown";
import type { QuireAiSkillRecord, QuireAiSkillStore } from "./types";
import { validateQuireAiSkillRecord } from "./validate";

const markdown = "---\nname: 通知\ndescription: \"写党政机关通知。\"\ncategory: 公文\nlicense: MIT\n---\n# 结构\n标题、主送机关、正文。";

describe("skill files", () => {
  it("reads metadata from the front matter of SKILL.md", () => {
    expect(readQuireAiSkillFrontMatter(markdown)).toEqual({ id: undefined, name: "通知", description: "写党政机关通知。", category: "公文", version: undefined, source: { license: "MIT" } });
    const record = readQuireAiSkillMarkdown(markdown, "notice");
    expect(validateQuireAiSkillRecord(record)).toEqual([]);
    expect(record).toMatchObject({ id: "notice", name: "通知", category: "公文", version: "1", source: { license: "MIT" } });
  });

  it("reads a zip with one skill folder, its name as the id, text as text and other files as bytes", () => {
    const zip = zipSync({
      "gov-notice/SKILL.md": strToU8(markdown), "gov-notice/presets/page.json": strToU8("{}"),
      "gov-notice/templates/t.docx": new Uint8Array([80, 75]), "__MACOSX/gov-notice/._SKILL.md": new Uint8Array([0])
    });
    const record = readQuireAiSkillArchive(zip);
    expect(record.id).toBe("gov-notice");
    expect(record.files.map(file => [file.path, file.mediaType, typeof file.content])).toEqual([
      ["SKILL.md", "text/markdown", "string"], ["presets/page.json", "application/json", "string"],
      ["templates/t.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "object"]
    ]);
  });

  it("writes an archive that reads back as the same skill, with the metadata in SKILL.md", () => {
    const record = { ...readQuireAiSkillMarkdown(markdown, "notice"), name: "通知（改）", version: "2" };
    const back = readQuireAiSkillArchive(writeQuireAiSkillArchive(record));
    expect(back).toMatchObject({ id: "notice", name: "通知（改）", version: "2", description: "写党政机关通知。" });
    expect(back.files[0]!.content).toContain("# 结构");
  });
});

describe("skill library writes", () => {
  it("saves to a writable source, refreshes, and refuses read-only sources and invalid skills", async () => {
    const saved = new Map<string, QuireAiSkillRecord>();
    const local: QuireAiSkillStore = {
      list: async () => [...saved.values()], get: async id => saved.get(id) ?? null,
      put: async record => { saved.set(record.id, record); }, remove: async id => { saved.delete(id); }
    };
    const library = createQuireAiSkillLibrary({ sources: [
      { id: "builtin", label: "内置", store: { list: async () => [], get: async () => null } },
      { id: "local", label: "本地", store: local }
    ] });
    expect(library.sources()).toEqual([{ id: "builtin", label: "内置", writable: false }, { id: "local", label: "本地", writable: true }]);
    const record = readQuireAiSkillMarkdown(markdown, "notice");
    await library.save("local", record);
    expect(library.entries().map(entry => entry.id)).toEqual(["notice"]);
    await library.save("local", { ...record, name: "改名" });
    expect((await library.read("notice"))?.name).toBe("改名");
    await expect(library.save("builtin", record)).rejects.toThrow("cannot save");
    await expect(library.save("local", { ...record, description: "" })).rejects.toThrow("description must be a non-empty string");
    await library.remove("local", "notice");
    expect(library.entries()).toEqual([]);
  });
});
