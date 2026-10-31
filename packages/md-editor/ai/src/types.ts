import type { QuireAiPiHostHeaderResolver } from "@quirekit/ai-orchestrator-pi";
import type { QuireAiModelConnection } from "@quirekit/ai-assistant";
import type { MdImageStorage } from "@quirekit/md-editor";
import type { MdEditorPanel } from "@quirekit/md-editor/vue";
import type { AnyExtension } from "@quirekit/msfe-core";

/** Host configuration of the MD Editor assistant. */
export interface MdEditorAiOptions {
  /** Document that owns the settings dialog. */
  readonly ownerDocument: Document;
  /** Browser-local persistence for provider settings, selected model and authorization preset. */
  readonly storage: Storage;
  /** Application-managed models. Supplying this hides local provider settings and bypasses saved connection preferences. */
  readonly connection?: (() => Promise<QuireAiModelConnection>) | undefined;
  /** AI Host used until the user saves explicit provider settings. */
  readonly defaultHostUrl?: string | undefined;
  /** Applies saved provider settings; defaults to reloading the page. */
  readonly reconnect?: (() => void) | undefined;
  /** Fetch implementation for tests or an application gateway. */
  readonly fetch?: typeof globalThis.fetch | undefined;
  /** Lazy resolver for application authentication headers sent to the Host. */
  readonly getHeaders?: QuireAiPiHostHeaderResolver | undefined;
  /** Identity the AI writes comments and changes as; default QuireKit AI. */
  readonly agent?: { readonly id: string; readonly name: string } | undefined;
  /** Open the panel when the editor mounts. */
  readonly defaultOpen?: boolean | undefined;
  /** Shows raw review differences for developers. */
  readonly diagnostics?: boolean | undefined;
  /** Where pictures the assistant places are stored; without it, only pictures the user gives by address can be placed. */
  readonly images?: MdImageStorage | undefined;
}

/** Assembled assistant for one page. */
export interface MdEditorAi {
  /** Panel to pass to `MdEditor`'s `panels`. */
  readonly panel: MdEditorPanel;
  /** Extensions to pass to `MdEditor`'s `extensions`, so the assistant can follow and highlight AI changes. */
  readonly extensions: readonly AnyExtension[];
  /** Removes the settings dialog; editors release their conversations themselves. */
  destroy(): void;
}
