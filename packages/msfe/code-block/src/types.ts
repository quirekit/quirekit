/** Source-derived code fence fields; the code body stays in CodeMirror. */
export interface CodeBlockAttributes {
  /** First info-string token, preserving the rest as source. */
  readonly language: string;
}

/** Presentation preferences; creating a placeholder never changes Markdown. */
export interface CodeBlockOptions {
  /** Offer an editable row when closed fences have no body line; default true. */
  readonly emptyLine: boolean;
  /** Accessible label for the empty code input entry. */
  readonly emptyLineLabel: string;
  /** Type a closing fence with every new opener so it never pairs with a later block's fence; default true. */
  readonly closeFence: boolean;
}


/** Named commands contributed when this feature is installed. */
declare module "@quirekit/msfe-core" {
  interface Commands<ReturnType> {
    /** codeBlock feature commands. */
    codeBlock: {
    /** @param language - Feature command input. @returns The caller’s result or pending chain. */
    setCodeLanguage(language: string): ReturnType;
    /** @returns The caller’s result or pending chain. */
    indentCode(): ReturnType;
    /** @returns The caller’s result or pending chain. */
    outdentCode(): ReturnType;
    };
  }
}
