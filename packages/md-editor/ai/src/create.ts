import { createQuireAiProviderSettings, resolveQuireAiModelConnection, type QuireAiModelConnection } from "@quirekit/ai-assistant";
import { MsfeAi } from "@quirekit/msfe-ai";
import { mountMdEditorAiPanel } from "./panel";
import type { MdEditorAi, MdEditorAiOptions } from "./types";

/**
 * Assembles the first-party MD Editor assistant: provider settings, model connection and the
 * side panel. Pass `panel` to `panels` and `extensions` to `extensions` of `MdEditor`.
 * @param options - Host document, storage and optional defaults.
 * @returns Panel, editor extensions and a page-level teardown.
 */
export function createMdEditorAi(options: MdEditorAiOptions): MdEditorAi {
  const settings = options.connection ? undefined : createQuireAiProviderSettings({
    ownerDocument: options.ownerDocument,
    defaultHostUrl: options.defaultHostUrl ?? "",
    storage: { local: options.storage },
    reconnect: options.reconnect ?? (() => options.ownerDocument.defaultView?.location.reload())
  });
  let resolving: Promise<QuireAiModelConnection> | undefined;
  /** @returns The page's model connection, resolved on first use. */
  const connection = () => resolving ??= options.connection ? options.connection() : resolveQuireAiModelConnection({
    ...(settings?.connection.mode === "browser" ? { browserCatalog: settings.connection.catalog } : {}),
    ...(settings?.connection.mode === "host" ? { hostUrl: settings.connection.hostUrl } : {}),
    fetch: options.fetch, getHeaders: options.getHeaders
  });
  return {
    panel: {
      id: "quirekit.ai",
      label: { "zh-CN": "AI 助手", en: "AI assistant" },
      icon: "sparkles",
      defaultOpen: options.defaultOpen ?? false,
      mount: context => mountMdEditorAiPanel(context, options, settings, connection)
    },
    extensions: [MsfeAi],
    destroy: () => settings?.destroy()
  };
}
