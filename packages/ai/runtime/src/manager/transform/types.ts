/** One plain-text model completion requested by a transform. */
export interface QuireAiModelCompletionRequest {
  /** System prompt; identical across the calls of one transform so provider prefix caching applies. */
  readonly system: string;
  /** User message holding one group of segments. */
  readonly prompt: string;
  /** Cancellation of the transform. */
  readonly signal: AbortSignal;
}

/** Plain-text answer of one completion. */
export interface QuireAiModelCompletion {
  /** Assistant text. */
  readonly text: string;
  /** Token usage when the provider reports it. */
  readonly usage?: {
    /** Input tokens, including cached ones. */
    readonly input: number;
    /** Output tokens. */
    readonly output: number;
    /** Input tokens served from the provider's prompt cache. */
    readonly cacheRead?: number | undefined;
  } | undefined;
}

/** Host-supplied model access for transforms; the AI core itself never calls a provider. */
export interface QuireAiModelPort {
  /**
   * Runs one completion without tools.
   * @param request - System prompt, user message and cancellation.
   * @returns Assistant text and usage.
   */
  complete(request: QuireAiModelCompletionRequest): Promise<QuireAiModelCompletion>;
}

/** Transform settings for one document SDK. */
export interface QuireAiTransformOptions {
  /** Model access used for each group of segments. */
  readonly model: QuireAiModelPort;
  /** Model calls running at the same time; default 3. */
  readonly concurrency?: number | undefined;
  /** Most segments in one call; default 40. */
  readonly segmentsPerCall?: number | undefined;
  /** Most segment characters in one call; default 6000. */
  readonly charactersPerCall?: number | undefined;
}

/** A transform run that was interrupted, kept so the same task can continue it. */
export interface QuireAiTransformRun {
  /** Blocks in scope when the run started. */
  readonly scope: ReadonlySet<string>;
  /** Blocks the run wrote. */
  readonly finished: Set<string>;
}

/** Blocks a transform is limited to or keeps away from, by view block id; a container brings the blocks inside it. */
export interface QuireAiTransformFilter {
  /** Only these blocks; every block in scope when omitted. */
  readonly blocks?: readonly string[] | undefined;
  /** Blocks left as they are. */
  readonly exclude?: readonly string[] | undefined;
}

/** Where a transform writes each result: a new paragraph after the block, or the block itself. */
export type QuireAiTransformPlacement = "after" | "replace";

/** One block encoded for the model. */
export interface QuireAiSegment {
  /** Number the model sees; unique within one transform. */
  readonly number: number;
  /** Block identity. */
  readonly block: string;
  /** Text with `<tN>` tags for differently formatted words, `<xN/>` objects and `<br/>` line breaks. */
  readonly text: string;
  /** Character formats every text run of the block shares. */
  readonly shared: Readonly<Record<string, unknown>>;
  /** Character formats of each tagged run, by tag number. */
  readonly tags: ReadonlyMap<number, Readonly<Record<string, unknown>>>;
  /** Object placeholders in the text. */
  readonly objects: number;
  /** Whether the block is numbered in sequence, so a result placed after it continues inside it. */
  readonly numbered: boolean;
}

/** What the model returned for one segment after checking. */
export type QuireAiSegmentAnswer =
  | {
      /** The answer kept every tag in place. */
      readonly status: "ok";
      /** Answer text with tags. */
      readonly text: string;
    }
  | {
      /** The answer's tags were broken; formatting falls back to the block's shared formats. */
      readonly status: "degraded";
      /** Answer text with tags removed. */
      readonly text: string;
    }
  | {
      /** No usable answer. */
      readonly status: "missing";
      /** Why the answer could not be used. */
      readonly reason: string;
    };
