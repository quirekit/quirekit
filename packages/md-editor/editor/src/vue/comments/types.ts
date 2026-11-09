import type { Component, Ref } from "vue";
import type { EditorState } from "@quirekit/cm-state";
import type { AnyExtension, MsfeEditor } from "@quirekit/msfe-core";
import type { QuireKitCommentMentionSource } from "@quirekit/ui/vue";
import type { MdActivityLocation } from "../activity/types";
import type { MdEditorLocale } from "../types";

/** How the product presents comments for the current width and layout. */
export type MdCommentsLayout = "none" | "side" | "panel";

/** A comment workspace installed through `MdEditorProps.comments`, such as the one `@quirekit/md-editor-comments` creates. */
export interface MdCommentsPlugin {
  /**
   * @param context - Product language and the draft action bound to the comment shortcut.
   * @returns Editor extensions for comment state, shortcuts and the `mdComments` bridge.
   */
  extensions(context: MdCommentsExtensionContext): readonly AnyExtension[];
  /**
   * Creates one editor's workspace; `MdEditor` calls it once during component setup.
   * @param input - Reactive editor, layout and host inputs.
   * @returns Presentation state, actions and the components `MdEditor` places.
   */
  setup(input: MdCommentsSetupInput): MdCommentsWorkspace;
}

/** Product hooks available while comment extensions are created. */
export interface MdCommentsExtensionContext {
  /** Product control language. */ readonly locale: MdEditorLocale;
  /** @returns Whether a draft opened for the current selection. */ openDraft(): boolean;
}

/** Reactive inputs `MdEditor` passes to a comment workspace. */
export interface MdCommentsSetupInput {
  /** Current editor. */ readonly editor: () => MsfeEditor | undefined;
  /** Accepted editor state. */ readonly state: () => EditorState | undefined;
  /** Editor root, whose width decides the presentation. */ readonly root: Readonly<Ref<HTMLElement | null>>;
  /** Whether the centered document layout is shown on a wide screen. */ readonly wide: () => boolean;
  /** Whether the narrow (mobile) presentation is active. */ readonly narrow: () => boolean;
  /** Whether the read-only reading view is showing. */ readonly reading: () => boolean;
  /** Product control language. */ readonly locale: () => MdEditorLocale;
  /** Host contacts offered after typing @ in a comment. */ readonly mentions: () => QuireKitCommentMentionSource | undefined;
}

/** One editor's comment presentation as `MdEditor` drives it. */
export interface MdCommentsWorkspace {
  /** Current presentation; `side` reserves the rail beside the document. */ readonly layout: Readonly<Ref<MdCommentsLayout>>;
  /** Whether the current user may add comments. */ readonly writable: Readonly<Ref<boolean>>;
  /** Whether a selection draft is open, which pauses other selection surfaces. */ readonly drafting: Readonly<Ref<boolean>>;
  /** @returns Whether a draft opened for the current selection. */ openDraft(): boolean;
  /** @returns Whether a draft for a comment on the whole document opened. */ openDocumentDraft(): boolean;
  /** @param direction - 1 for next, -1 for previous. @returns Whether a thread was focused. */ step(direction: 1 | -1): boolean;
  /** Shows the list of every thread. */ showList(): void;
  /** @param visible - Whether the side rail of anchored comments is shown. */ setRailVisible(visible: boolean): void;
  /** Section placed after the document, or null when the host keeps document comments in the list. */ readonly documentSection: Component | null;
  /** Rail rendered beside the document while `layout` is `side`. */ readonly rail: Component;
  /** List drawer of every thread. */ readonly list: Component;
}

/** Comment services the toolbar, file dialog and activity panel read from an editor. */
export interface MdCommentsBridge {
  /** @returns Whether the current user may add comments. */ writable(): boolean;
  /**
   * @param state - Current editor state.
   * @param threadId - Thread recorded by an activity.
   * @returns Where the thread is now.
   */
  locate(state: EditorState, threadId: string): MdActivityLocation;
  /** @returns Whether Markdown can be exported with comment marks. */ exportsReview(): boolean;
  /** @param markdown - Source snapshot. @returns The snapshot with comments written as marks. */ exportReview(markdown: string): Promise<string>;
  /** @returns Whether imported Markdown is scanned for comment marks. */ importsReview(): boolean;
  /**
   * Splits imported Markdown into clean source and comments; the comments are merged after the source is committed.
   * @param markdown - Imported file text.
   * @returns Clean source and a merge step, or null when nothing applies.
   */
  readReview(markdown: string): Promise<MdCommentsReview | null>;
}

/** Imported Markdown with its comment marks removed. */
export interface MdCommentsReview {
  /** Source without marks. */ readonly markdown: string;
  /** Number of comments found. */ readonly count: number;
  /** Adds the found comments once the clean source is in the editor. */ merge(): void;
}
