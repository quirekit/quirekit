import type { MsfeTarget } from "@quirekit/msfe-core";
import type { MdDialogKind } from "../dialogs/types";
import type { MdFileMode } from "../files/types";
/** Shared product intents used by desktop and mobile chrome. */
export interface MdChromeIntents {
  /** Explain an operation refusal without changing document content. @param message - Localized recoverable feedback. */ feedback?(message: string): void;
  /** Open the existing source-anchored parameter workspace. @param kind - Installed editor. @param target - Retained source selection. @param body - Optional canonical template. */
  edit(kind: MdDialogKind, target?: MsfeTarget, body?: string): void;
  /** Open an explicit file operation. @param mode - Existing file protocol. @param exporter - Installed format identity. */ file(mode: MdFileMode, exporter?: string): void;
  /** Open the host-installed export library. */ template(): void;
  /** Open a comment draft for the selection. */ comment?(): void;
  /** Show the comment list. */ comments?(): void;
  /** Open a draft for a comment on the whole document. */ documentComment?(): void;
  /** Focus the next (1) or previous (-1) comment. */ commentStep?(direction: 1 | -1): void;
  /** Show the keyboard shortcut reference. */ shortcuts?(): void;
}
