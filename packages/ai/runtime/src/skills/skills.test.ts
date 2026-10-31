import { describe, expect, it } from "vitest";
import { createQuireAiSkillLibrary } from "./library";
import { createQuireAiMemorySkillStore } from "./stores/memory";
import { fromQuireAiSkillJson, toQuireAiSkillJson } from "./json";
import { createQuireAiSkillTool } from "./tool";
import type { QuireAiSkillRecord } from "./types";
import { validateQuireAiSkillRecord } from "./validate";

/** @param id - Skill id. @param extra - Overrides. @returns A valid skill. */
function skill(id: string, extra: Partial<QuireAiSkillRecord> = {}): QuireAiSkillRecord {
  return {
    id, name: `技能 ${id}`, description: `用于 ${id}。`, category: "公文", version: "1",
    files: [{ path: "SKILL.md", mediaType: "text/markdown", content: `---\nname: ${id}\n---\n# 写法\n按 ${id} 的结构写。` }],
    ...extra
  };
}

/** @param tool - Skill tool. @param input - Arguments. @returns Model-visible text. */
async function call(tool: ReturnType<typeof createQuireAiSkillTool>, input: object): Promise<string> {
  return (await tool.execute(input as never, { callId: "c", signal: new AbortController().signal })).summary!;
}

describe("skill data format", () => {
  it("accepts a valid skill and names each problem of an invalid one", () => {
    expect(validateQuireAiSkillRecord(skill("notice"))).toEqual([]);
    expect(validateQuireAiSkillRecord({ ...skill("Bad Id"), name: "", files: [{ path: "../x", mediaType: "text/plain", content: "" }] })).toEqual([
      "id must be 1-64 lower-case letters and digits, separated by single -, _ or .",
      "name must be a non-empty string",
      "file path \"../x\" must be relative, without empty, . or .. parts",
      "SKILL.md is required"
    ]);
  });

  it("round-trips binary files through the JSON form as base64", () => {
    const record = skill("resume", { files: [...skill("resume").files, { path: "templates/a.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: new Uint8Array([80, 75, 3, 4]) }] });
    const json = toQuireAiSkillJson(record);
    expect(json.files[1]).toMatchObject({ content: "UEsDBA==", encoding: "base64" });
    expect(fromQuireAiSkillJson(JSON.parse(JSON.stringify(json)))).toEqual(record);
  });
});

describe("skill library and skill_read", () => {
  it("lets a later source override a skill of the same id and reads it from there", async () => {
    const library = createQuireAiSkillLibrary({ sources: [
      { id: "builtin", label: "内置", store: createQuireAiMemorySkillStore([skill("notice"), skill("resume")]) },
      { id: "org", label: "组织", store: createQuireAiMemorySkillStore([skill("notice", { name: "组织通知", version: "2" })]) }
    ] });
    expect(await library.refresh()).toEqual([]);
    expect(library.entries().map(entry => [entry.id, entry.sourceId, entry.overrides])).toEqual([["notice", "org", ["builtin"]], ["resume", "builtin", []]]);
    expect((await library.read("notice"))?.name).toBe("组织通知");
  });

  it("keeps a failing source's previous list and reports it", async () => {
    let fail = false;
    const store = { list: async () => { if (fail) throw new Error("offline"); return [skill("notice")]; }, get: async () => skill("notice") };
    const library = createQuireAiSkillLibrary({ sources: [{ id: "server", label: "服务器", store }] });
    await library.refresh();
    fail = true;
    expect(await library.refresh()).toEqual(["服务器: offline"]);
    expect(library.entries().map(entry => entry.id)).toEqual(["notice"]);
  });

  it("lists enabled skills in its description and reads instructions, files and searches", async () => {
    const library = createQuireAiSkillLibrary({
      sources: [{ id: "builtin", label: "内置", store: createQuireAiMemorySkillStore([
        skill("notice", { files: [...skill("notice").files, { path: "presets/page.json", mediaType: "application/json", content: "{\"paper\":\"A4\"}" },
          { path: "templates/t.docx", mediaType: "application/octet-stream", content: new Uint8Array([1]) }] }),
        skill("hidden")
      ]) }],
      enabled: entry => entry.id !== "hidden"
    });
    await library.refresh();
    const tool = createQuireAiSkillTool(library);
    expect(tool.description).toContain("- notice (公文): 技能 notice — 用于 notice。");
    expect(tool.description).not.toContain("hidden");
    expect(await call(tool, { id: "notice" })).toBe("# 技能 notice\n# 写法\n按 notice 的结构写。\n\nFiles:\n- presets/page.json (application/json)\n- templates/t.docx (application/octet-stream)");
    expect(await call(tool, { id: "notice", file: "presets/page.json" })).toBe("{\"paper\":\"A4\"}");
    expect(await call(tool, { id: "notice", file: "templates/t.docx" })).toContain("binary");
    expect(await call(tool, { id: "hidden" })).toBe("Skill hidden is not available. Available: notice.");
    expect(await call(tool, { query: "不存在" })).toBe("No skill matches.");
  });
});
