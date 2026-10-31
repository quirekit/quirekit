/** One file of a skill. */
export interface QuireAiSkillFile {
  /** Relative path inside the skill, such as `SKILL.md` or `templates/resume.docx`. */
  readonly path: string;
  /** Media type, such as `text/markdown` or `image/svg+xml`. */
  readonly mediaType: string;
  /** UTF-8 text for text files; bytes for binary files such as DOCX templates. */
  readonly content: string | Uint8Array;
}

/** Where a skill comes from and under which licence, for skills adapted from others. */
export interface QuireAiSkillSourceInfo {
  /** Original location. */
  readonly url?: string | undefined;
  /** Original author or organisation. */
  readonly author?: string | undefined;
  /** Licence identifier, such as `MIT`. */
  readonly license?: string | undefined;
}

/** Summary of a skill, enough to list it and let the model choose it. */
export interface QuireAiSkillSummary {
  /** Stable identifier: lower-case letters, digits and single `-`, `_` or `.` separators. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** One or two sentences: what the skill is for and when to use it. */
  readonly description: string;
  /** Category, such as `公文`, `简历` or `报告`. */
  readonly category: string;
  /** Version; a changed version invalidates cached content. */
  readonly version: string;
  /** Origin and licence of an adapted skill. */
  readonly source?: QuireAiSkillSourceInfo | undefined;
}

/** A complete skill: its summary and files. `SKILL.md` is required. */
export interface QuireAiSkillRecord extends QuireAiSkillSummary {
  /** Files of the skill. */
  readonly files: readonly QuireAiSkillFile[];
}

/**
 * Supplies skills in the QuireKit data format. How they are stored and fetched is the
 * implementer's choice: browser storage, a server, a Git repository or anything else.
 */
export interface QuireAiSkillStore {
  /** @returns Summaries of every skill the store holds. */
  list(): Promise<readonly QuireAiSkillSummary[]>;
  /**
   * @param id - Skill identifier.
   * @returns The complete skill, or null when the store does not hold it.
   */
  get(id: string): Promise<QuireAiSkillRecord | null>;
  /**
   * Saves a skill; stores without it are read-only.
   * @param record - Validated skill.
   */
  put?(record: QuireAiSkillRecord): Promise<void>;
  /**
   * Removes a skill; stores without it are read-only.
   * @param id - Skill identifier.
   */
  remove?(id: string): Promise<void>;
}

/** One store of a skill library with its identity. */
export interface QuireAiSkillLibrarySource {
  /** Source identifier, such as `builtin`, `local` or `organization`. */
  readonly id: string;
  /** Display label of the source. */
  readonly label: string;
  /** Store supplying the skills. */
  readonly store: QuireAiSkillStore;
}

/** A listed skill with the source it comes from. */
export interface QuireAiSkillEntry extends QuireAiSkillSummary {
  /** Source the skill is taken from. */
  readonly sourceId: string;
  /** Sources holding a skill of the same id that this one overrides. */
  readonly overrides: readonly string[];
}

/** Options of a skill library. */
export interface QuireAiSkillLibraryOptions {
  /** Sources in increasing priority: a later source overrides a skill of the same id in an earlier one. */
  readonly sources: readonly QuireAiSkillLibrarySource[];
  /**
   * Decides whether a listed skill is offered to the model; default every skill.
   * @param entry - Listed skill.
   * @returns Whether the model may use it.
   */
  readonly enabled?: ((entry: QuireAiSkillEntry) => boolean) | undefined;
}

/** A source as the library presents it. */
export interface QuireAiSkillLibrarySourceInfo {
  /** Source identifier. */
  readonly id: string;
  /** Display label. */
  readonly label: string;
  /** Whether the store can save and remove skills. */
  readonly writable: boolean;
}

/** Skills from several sources, with a synchronous snapshot for tool descriptions. */
export interface QuireAiSkillLibrary {
  /** @returns Sources in increasing priority. */
  sources(): readonly QuireAiSkillLibrarySourceInfo[];
  /** @returns Skills from every source after overriding, enabled or not, in id order. */
  entries(): readonly QuireAiSkillEntry[];
  /** @returns Skills the model may use, in id order. */
  enabledEntries(): readonly QuireAiSkillEntry[];
  /**
   * Reloads every source's list; a source that fails keeps its previous list.
   * @returns Problems per source, empty when all loaded.
   */
  refresh(): Promise<readonly string[]>;
  /**
   * Reads a skill from the source it is listed from, validated against the data format.
   * @param id - Skill identifier.
   * @returns The skill, or null when it is not listed or not valid.
   */
  read(id: string): Promise<QuireAiSkillRecord | null>;
  /**
   * Reads a skill as one source holds it, such as a version another source overrides.
   * @param sourceId - Source identifier.
   * @param id - Skill identifier.
   * @returns The skill, or null when the source does not hold a valid one.
   */
  readFrom(sourceId: string, id: string): Promise<QuireAiSkillRecord | null>;
  /**
   * Saves a skill to a writable source after checking it against the data format, then refreshes.
   * @param sourceId - Writable source.
   * @param record - Skill to save.
   */
  save(sourceId: string, record: QuireAiSkillRecord): Promise<void>;
  /**
   * Removes a skill from a writable source, then refreshes.
   * @param sourceId - Writable source.
   * @param id - Skill identifier.
   */
  remove(sourceId: string, id: string): Promise<void>;
  /**
   * @param listener - Called after the listed skills change.
   * @returns Unsubscribe function.
   */
  subscribe(listener: () => void): () => void;
}
