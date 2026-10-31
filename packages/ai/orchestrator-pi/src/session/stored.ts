import { err, FileError, JsonlSessionRepo, ok, type FileInfo, type FileKind, type FileSystem, type Session } from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import type { QuireAiPiSessionOpenRequest } from "../types";

/** Entry a host reports for a stored session path. */
export interface QuireAiSessionFileEntry {
  /** Base name. */
  readonly name: string;
  /** Object kind. */
  readonly kind: FileKind;
  /** Size in bytes. */
  readonly size: number;
  /** Modification time in milliseconds since the Unix epoch. */
  readonly mtimeMs: number;
}

/**
 * Host storage of conversation files, addressed by absolute paths under `/sessions`. Hosts keep them
 * wherever they like (an app data folder, IndexedDB) and must reject paths that leave that root.
 */
export interface QuireAiSessionFiles {
  /** @param path - Addressed path. @returns Its entry, or null when missing. */
  info(path: string): Promise<QuireAiSessionFileEntry | null>;
  /** @param path - Directory. @returns Direct children; empty when missing. */
  list(path: string): Promise<readonly QuireAiSessionFileEntry[]>;
  /** @param path - File. @returns UTF-8 text, or null when missing. */
  read(path: string): Promise<string | null>;
  /** @param path - File, created with its parents when missing. @param content - UTF-8 text to append. */
  append(path: string, content: string): Promise<void>;
  /** @param path - File to create or replace, with its parents. @param content - UTF-8 text. */
  write(path: string, content: string): Promise<void>;
  /** @param from - Existing file. @param to - Destination, replaced when it exists. */
  rename(from: string, to: string): Promise<void>;
  /** @param path - Directory to create with its parents. */
  createDir(path: string): Promise<void>;
  /** @param path - File or directory. @param recursive - Whether to remove a non-empty directory. */
  remove(path: string, recursive: boolean): Promise<void>;
}

/** Conversations kept in host files, so a document's model memory survives restarts. */
export interface QuireAiStoredSessions {
  /**
   * @param saved - Session to continue, when the conversation has one.
   * @param opened - Receives the identity of the session actually opened or created, to store with the conversation.
   * @returns Adapter for the coordinator's `openSession`.
   */
  open(saved: string | undefined, opened: (id: string) => void): (request: QuireAiPiSessionOpenRequest) => Promise<Session>;
}

/** Root of the addressed namespace. */
const ROOT = "/sessions";
/** Working directory recorded in every session; one shared folder of files. */
const CWD = "/quire";

/** @param path - Absolute or root-relative path. @returns Normalized absolute path, or undefined when it leaves the root. */
function normalize(path: string): string | undefined {
  const parts: string[] = [];
  for (const part of (path.startsWith("/") ? path : `${ROOT}/${path}`).split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") { if (parts.pop() === undefined) return undefined; continue; }
    parts.push(part);
  }
  const normalized = `/${parts.join("/")}`;
  return normalized === ROOT || normalized.startsWith(`${ROOT}/`) || normalized === CWD ? normalized : undefined;
}

/**
 * Adapts host files to the part of Pi's FileSystem its JSONL session repository uses. Other operations
 * report `not_supported`; paths outside `/sessions` are rejected before reaching the host.
 * @param files - Host storage.
 * @returns Pi file system.
 */
function sessionFileSystem(files: QuireAiSessionFiles): FileSystem {
  /** @param path - Requested path. @param run - Operation on the normalized path. @returns Result, with host failures as `unknown`. */
  const guard = async <T>(path: string, run: (absolute: string) => Promise<T>) => {
    const absolute = normalize(path);
    if (absolute === undefined) return err<T, FileError>(new FileError("permission_denied", "Session files stay under their root.", path));
    try { return ok<T, FileError>(await run(absolute)); }
    catch (error) { return err<T, FileError>(error instanceof FileError ? error : new FileError("unknown", error instanceof Error ? error.message : String(error), absolute)); }
  };
  /** @param absolute - Normalized path. @param entry - Host entry. @returns Pi file info. */
  const toInfo = (absolute: string, entry: QuireAiSessionFileEntry): FileInfo => ({ name: entry.name, path: absolute, kind: entry.kind, size: entry.size, mtimeMs: entry.mtimeMs });
  /** @param path - File path. @returns Text, or a `not_found` failure. */
  const text = async (path: string) => {
    const content = await files.read(path);
    if (content === null) throw new FileError("not_found", "No such session file.", path);
    return content;
  };
  const unsupported = async () => err<never, FileError>(new FileError("not_supported", "Not used by session storage."));
  return {
    cwd: ROOT,
    absolutePath: async (path) => { const absolute = normalize(path); return absolute === undefined ? err(new FileError("permission_denied", "Session files stay under their root.", path)) : ok(absolute); },
    joinPath: async parts => { const joined = normalize(parts.join("/").replace(/\/+/gu, "/")); return joined === undefined ? err(new FileError("invalid", "Session path leaves its root.")) : ok(joined); },
    readTextFile: path => guard(path, text),
    async openTextLineReader(path) {
      const result = await guard(path, text);
      if (!result.ok) return result;
      const lines = result.value.split("\n");
      const terminated = result.value.endsWith("\n");
      if (terminated) lines.pop();
      let index = 0;
      return ok({
        readLine: async () => index < lines.length ? ok({ text: lines[index]!, terminated: index++ < lines.length - 1 || terminated }) : ok(undefined),
        close: async () => undefined
      });
    },
    async readTextLines(path, options) {
      const result = await guard(path, text);
      if (!result.ok) return result;
      const lines = result.value.split("\n");
      if (result.value.endsWith("\n")) lines.pop();
      return ok(options?.maxLines === undefined ? lines : lines.slice(0, options.maxLines));
    },
    readBinaryFile: unsupported,
    writeFile: (path, content) => guard(path, absolute => files.write(absolute, typeof content === "string" ? content : new TextDecoder().decode(content))),
    appendFile: (path, content) => guard(path, absolute => files.append(absolute, typeof content === "string" ? content : new TextDecoder().decode(content))),
    async renameFile(from, to) {
      const destination = normalize(to);
      if (destination === undefined) return err(new FileError("permission_denied", "Session files stay under their root.", to));
      return guard(from, absolute => files.rename(absolute, destination));
    },
    async fileInfo(path) {
      const result = await guard(path, absolute => files.info(absolute));
      if (!result.ok) return result;
      return result.value === null ? err(new FileError("not_found", "No such session file.", normalize(path))) : ok(toInfo(normalize(path)!, result.value));
    },
    listDir: (path) => guard(path, async absolute => (await files.list(absolute)).map(entry => toInfo(`${absolute === "/" ? "" : absolute}/${entry.name}`, entry))),
    canonicalPath: async path => { const absolute = normalize(path); return absolute === undefined ? err(new FileError("permission_denied", "Session files stay under their root.", path)) : ok(absolute); },
    exists: (path) => guard(path, async absolute => (await files.info(absolute)) !== null),
    createDir: (path) => guard(path, absolute => files.createDir(absolute)),
    remove: (path, options) => guard(path, async (absolute) => {
      if (options?.force !== true && (await files.info(absolute)) === null) throw new FileError("not_found", "No such session file.", absolute);
      await files.remove(absolute, options?.recursive === true);
    }),
    createTempDir: unsupported,
    createTempFile: unsupported,
    cleanup: async () => undefined
  };
}

/**
 * Keeps Quire AI conversations in host files through Pi's own JSONL session repository: the host stores
 * plain text files, Pi keeps the transcript format, branches and recovery semantics.
 * @param files - Host storage under `/sessions`.
 * @returns Session opener factory for responders.
 */
export function createQuireAiStoredSessions(files: QuireAiSessionFiles): QuireAiStoredSessions {
  const repo = new JsonlSessionRepo({ fileSystem: sessionFileSystem(files), sessionsRoot: ROOT });
  return {
    open(saved, opened) {
      let current = saved;
      return async (request) => {
        if (!request.fresh && current !== undefined) {
          const metadata = (await repo.list({ cwd: CWD }, BACKGROUND_CONTEXT)).find(item => item.id === current);
          // A missing or unreadable conversation starts again rather than failing every request.
          if (metadata !== undefined) {
            const session = await repo.open(metadata, BACKGROUND_CONTEXT).catch(() => undefined);
            if (session !== undefined) return session;
          }
        }
        const session = await repo.create({ cwd: CWD }, BACKGROUND_CONTEXT);
        current = session.metadata.id;
        opened(current);
        return session;
      };
    }
  };
}
