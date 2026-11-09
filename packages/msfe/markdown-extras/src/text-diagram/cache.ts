import type { PreviewOutputCache, PreviewProps, PreviewTypography } from "../shared/types";

const maxEntries = 32, maxBytes = 2 * 1024 * 1024;

/**
 * @param props - Renderer family and exact source body. @param typography - Font role the output was laid out with.
 * @returns A key for PlantUML/DOT (source fonts) and for Mermaid with its host font role, or undefined when ineligible.
 */
function key(props: PreviewProps, typography: PreviewTypography | undefined): string | undefined {
  const language = props.kind === "mermaid" ? "mermaid" : props.kind === "textDiagram" ? props.language : undefined;
  if (language === "plantuml" || language === "dot") return JSON.stringify([language, props.text]);
  // Mermaid measures labels in the host font, so the font role is part of its identity.
  return language === "mermaid" && typography?.fontFamily ? JSON.stringify([language, props.text, typography.fontFamily, typography.fontSize]) : undefined;
}

/** @param entries - Bounded owner-local outputs. @returns Conservative key/HTML UTF-16 text bytes, without retaining DOM or editor objects. */
function bytes(entries: Map<string, string>): number {
  let size = 0;
  for (const [identity, html] of entries) size += (identity.length + html.length) * 2;
  return size;
}

/**
 * Successful sanitized diagrams shared across remounts/readers in one document, with exact-source
 * admission and bounded LRU storage. Each renderer variant owns one cache.
 * @returns An empty cache.
 */
export function createTextDiagramPreviewCache(): PreviewOutputCache {
  const documents = new WeakMap<Document, Map<string, string>>();
  return {
    /** @param props - Exact source body. @param owner - Mounted document. @param typography - Current font role. @returns Accepted output if available, promoting it to most recently used. */
    get(props, owner, typography) {
      const identity = key(props, typography), entries = documents.get(owner);
      if (identity === undefined || !entries) return undefined;
      const html = entries.get(identity);
      if (html !== undefined) { entries.delete(identity); entries.set(identity, html); }
      return html;
    },
    /** @param props - Completed request body. @param owner - Mounted document. @param html - Sanitized successful output, never source/error text. @param typography - Font role it was laid out with. */
    set(props, owner, html, typography) {
      const identity = key(props, typography);
      // Output measured before web fonts finish loading would be reused with the wrong label widths.
      if (identity === undefined || typography && owner.fonts && owner.fonts.status !== "loaded") return;
      const entries = documents.get(owner) ?? new Map<string, string>();
      entries.delete(identity);
      if ((identity.length + html.length) * 2 > maxBytes) return;
      entries.set(identity, html);
      // At most 32 entries participate in eviction; source input and selection
      // updates do no scanning, and oversized diagrams remain renderable uncached.
      while (entries.size > maxEntries || bytes(entries) > maxBytes) entries.delete(entries.keys().next().value!);
      documents.set(owner, entries);
    },
  };
}

/** Cache of the shared text-diagram renderer. */
export const textDiagramPreviewCache = createTextDiagramPreviewCache();
