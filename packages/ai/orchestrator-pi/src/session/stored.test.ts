import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { describe, expect, it } from "vitest";
import { createQuireAiStoredSessions, type QuireAiSessionFiles } from "./stored";

/** @returns Host files kept in a map, with directories implied by their files. */
function memoryFiles(): QuireAiSessionFiles & { readonly paths: () => string[] } {
  const files = new Map<string, string>();
  const directories = new Set<string>(["/sessions"]);
  const children = (path: string) => [...new Set([...files.keys(), ...directories]
    .filter(item => item.startsWith(`${path}/`)).map(item => item.slice(path.length + 1).split("/")[0]!))];
  return {
    paths: () => [...files.keys()],
    info: async path => files.has(path) ? { name: path.split("/").at(-1)!, kind: "file", size: files.get(path)!.length, mtimeMs: 1 }
      : directories.has(path) ? { name: path.split("/").at(-1)!, kind: "directory", size: 0, mtimeMs: 1 } : null,
    list: async path => children(path).map(name => ({ name, kind: files.has(`${path}/${name}`) ? "file" : "directory", size: 0, mtimeMs: 1 })),
    read: async path => files.get(path) ?? null,
    append: async (path, content) => { files.set(path, (files.get(path) ?? "") + content); },
    write: async (path, content) => { files.set(path, content); },
    rename: async (from, to) => { files.set(to, files.get(from) ?? ""); files.delete(from); },
    createDir: async (path) => { directories.add(path); },
    remove: async (path) => { files.delete(path); directories.delete(path); }
  };
}

describe("createQuireAiStoredSessions", () => {
  it("keeps a conversation in host files and reopens it after a restart", async () => {
    const files = memoryFiles();
    let saved: string | undefined;
    const first = await createQuireAiStoredSessions(files).open(undefined, (id) => { saved = id; })({ fresh: false });
    expect(saved).toBe(first.metadata.id);
    await first.setName("周报", BACKGROUND_CONTEXT);
    await first.close(BACKGROUND_CONTEXT);
    expect(files.paths().every(path => path.startsWith("/sessions/"))).toBe(true);

    // A new repository over the same files stands in for the next app start.
    const reopened = await createQuireAiStoredSessions(files).open(saved, () => { throw new Error("must not create"); })({ fresh: false });
    expect(reopened.metadata.id).toBe(saved);
    expect(await reopened.getName(BACKGROUND_CONTEXT)).toBe("周报");
    await reopened.close(BACKGROUND_CONTEXT);

    let renewed: string | undefined;
    const fresh = await createQuireAiStoredSessions(files).open(saved, (id) => { renewed = id; })({ fresh: true, previousSessionId: saved });
    expect(renewed).toBe(fresh.metadata.id);
    expect(renewed).not.toBe(saved);
  });

  it("starts again when the saved conversation is gone", async () => {
    let created: string | undefined;
    const session = await createQuireAiStoredSessions(memoryFiles()).open("missing", (id) => { created = id; })({ fresh: false });
    expect(created).toBe(session.metadata.id);
  });
});
