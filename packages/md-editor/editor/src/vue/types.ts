import type { MarkdownComponents, MarkdownHtmlOptions } from "@quirekit/incremark/vue";
import type { CodeLanguage, MsfeEditor } from "@quirekit/msfe-core";
import type { EditorState } from "@quirekit/cm-state";
import type { MdEditorExtensionOptions, MdEditorView, MdImageSource } from "../types";
import type { MdDocumentLinks, MdMentionSource } from "../commands/types";
import type { MdImageStorage } from "../images/types";
import type { MdDocxOptions } from '../docx/types';
import type { MdExporter } from '../export/types';
import type { ExportTemplateProvider, ExportTemplateReference } from '@quirekit/export-template';
import type { MdFileMode } from './files/types';
import type { MdCommentsPlugin } from './comments/types';
import type { MdEditorPanel } from '../panels/types';

/** Product control language. Document content remains untouched. */
export type MdEditorLocale = "zh-CN" | "en";

/** Toolbar presentation; narrow screens use the mobile dock whenever it is not false. */
export type MdEditorToolbar = boolean | "fixed" | "floating";

/** Vue product mount options. Replace documents explicitly through the exposed editor. */
export interface MdEditorProps extends Omit<MdEditorExtensionOptions, "view"> {
  /** Host-installed export formats, such as PDF or OFD; each receives the selected template and conversion policy. */ readonly exporters?: readonly MdExporter[];
  /** Optional host-owned catalog. Add the export-templates slot to expose a library button. */ readonly templates?: ExportTemplateProvider;
  /** Controlled, document-specific export selection; omission is instance-local. */ readonly exportStyle?: ExportTemplateReference;
  /** Host-installed Word converter and conversion policy; omitted or false hides the Word actions. */ readonly docx?: false | MdDocxOptions;
  /** Host-owned contacts or cancellable search; enables the @ trigger and insertion picker. */ readonly mentions?: MdMentionSource;
  /** Host document links: `[[` search inserts a link, recognized links render as references with a hover preview. Read once on mount. */ readonly documentLinks?: MdDocumentLinks;
  /** Host image storage; enables pasting, dropping and uploading images. Read once on mount. */ readonly images?: MdImageStorage;
  /** Maps stored image addresses to displayed ones, e.g. site-relative paths of a remote site or local files read into blob URLs. Read once on mount. */ readonly imageSource?: MdImageSource;
  /** Hint shown while an editable document is empty; an empty string hides it. Defaults to a localized prompt. Read once on mount. */ readonly placeholder?: string;
  /** Comment workspace, such as `mdComments()` from `@quirekit/md-editor-comments`; omitted or false hides comments. Read once on mount. */ readonly comments?: MdCommentsPlugin | false;
  /** Initial Markdown, read once on mount; omit when a prepared source provider owns initialization. */ readonly markdown?: string;
  /** Language for every product control. */ readonly locale?: MdEditorLocale;
  /** Accessible document name. */ readonly label?: string;
  /** Stops input in document view, live preview and source view; the reading view is always read-only. */ readonly readOnly?: boolean;
  /** Product toolbar: true/"fixed" keeps it above the document, "floating" shows formatting above a desktop text selection, false hides it. */ readonly toolbar?: MdEditorToolbar;
  /** With the fixed toolbar, also float style, inline formats, link and comment above a desktop text selection; defaults to true. */ readonly selectionToolbar?: boolean;
  /** Show shared source block handles, menus and drag sorting. Read once on mount. */ readonly blockControls?: boolean;
  /** Enable searchable / insertion in empty paragraphs; defaults to true, independently of block controls. */ readonly slashMenu?: boolean;
  /** Embedded frame or full-width sticky toolbar with a centered document. */ readonly layout?: "embedded" | "document";
  /** Heading outline beside the document in the document layout, following the reading position; defaults to false. */ readonly outline?: boolean;
  /** Outline side: `start` before the document (left in left-to-right text) or `end` after it; defaults to `start`, leaving the end side to comments. */ readonly outlinePosition?: MdOutlinePosition;
  /** Lazy code languages shared with the canonical editor. */ readonly codeLanguages?: readonly CodeLanguage[];
  /** Current view of the same source: document (default), live preview, source or reading; switching keeps selection and history and focuses the document. Bind with `v-model:view` so Mod-Alt-V can step through the views. */ readonly view?: MdEditorView;
  /** Host commands appended to the desktop selection toolbar; also offered on a readonly source. */ readonly selectionActions?: readonly MdSelectionAction[];
  /** Host side panels, such as an assistant, each with a toolbar toggle; docked at the document's end. Read once on mount. */ readonly panels?: readonly MdEditorPanel[];
}

/** The selected Markdown source handed to a host selection action. */
export interface MdSelectionContext {
  /** Selected Markdown source. */ readonly text: string;
  /** Source offset where the selection starts. */ readonly from: number;
  /** Source offset where the selection ends. */ readonly to: number;
  /** One-based source line of the selection start. */ readonly startLine: number;
  /** One-based source line of the selection end. */ readonly endLine: number;
}

/** Host command on the desktop selection toolbar, such as sending the text to an assistant. */
export interface MdSelectionAction {
  /** Stable identity within this editor. */ readonly id: string;
  /** Visible and accessible name. */ readonly label: string;
  /** Icon name resolved by the current QuireIconProvider. */ readonly icon?: string;
  /** @param selection - Selection when the action was chosen. */ readonly run: (selection: MdSelectionContext) => void;
}

/** Public component instance for persistence, snapshots and advanced source commands. */
export interface MdEditorInstance {
  /** Current mounted source owner, absent before mount. */ readonly editor: MsfeEditor | undefined;
  /**
   * Open the same import or export task as the built-in file menu, for host-owned menus and toolbars.
   * Ignored while another product task is open, or when the action is not enabled (Word disabled, unknown exporter).
   * @param mode - Markdown or Word import, Word export, or an installed format export.
   * @param exporter - Installed exporter id, required for `formatExport`.
   */
  openFile(mode: MdFileMode, exporter?: string): void;
  /** Opens the list of every comment; does nothing when comments are off. */ showComments(): void;
  /**
   * Shows or hides the side rail of anchored comments; the document re-centers while it is hidden. Starting a new comment shows it again.
   * @param visible - Whether the rail is shown.
   */
  setCommentRailVisible(visible: boolean): void;
}

/** Discardable reading view of either a parsed snapshot or host-owned Markdown text. */
export interface MdProseProps {
  /** Disable the shared block projection cache for diagnostics; parsing remains incremental. */ readonly cache?: boolean;
  /** Shared semantic component overrides, without changing parsing. */ readonly components?: MarkdownComponents;
  /** Explicit HTML sanitization policy; default preserves raw source. */ readonly html?: boolean | MarkdownHtmlOptions;
  /** Accepted immutable editor state; mutually exclusive with content. */ readonly state?: EditorState;
  /** Authoritative full Markdown; append, replace or clear it as the stream changes. */ readonly content?: string;
  /** Transport status only; stopping never discards source or freezes reference semantics. */ readonly status?: "receiving" | "complete" | "stopped" | "error";
  /** Changing the message identity releases its previous reading session and resources. */ readonly identity?: string;
  /** Source-mode grammar/reading configuration; replace its identity to reconfigure. */ readonly options?: MdEditorExtensionOptions;
  /** Language for copy, disclosure and task controls. */ readonly locale?: MdEditorLocale;
}

/** Side of the document the outline sits on. */
export type MdOutlinePosition = "start" | "end";
