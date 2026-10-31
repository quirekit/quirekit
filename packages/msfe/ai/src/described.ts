import type { QuireAiAnnotation, QuireAiAnnotationCapability, QuireAiSourceCapability, QuireAiSourceDescribedChange } from "@quirekit/ai-runtime/source";

/** Annotations of every annotation fact, keyed by fact label and annotation id. */
export type MsfeAiAnnotationState = ReadonlyMap<string, { readonly label: string; readonly annotation: QuireAiAnnotation }>;

/** Characters of a message or quote shown in a review entry. */
const excerptLength = 60;

/**
 * @param capabilities - Installed facts.
 * @returns Current annotations.
 */
export function readMsfeAiAnnotations(capabilities: readonly QuireAiSourceCapability[]): MsfeAiAnnotationState {
  const state = new Map<string, { label: string; annotation: QuireAiAnnotation }>();
  for (const fact of capabilities.filter((item): item is QuireAiAnnotationCapability => item.kind === "annotation")) {
    for (const annotation of fact.read()) state.set(`${fact.label}\u0000${annotation.id}`, { label: fact.label, annotation });
  }
  return state;
}

/**
 * Names what an AI write changed in annotations, for the request review: new threads and
 * messages, resolved and reopened threads, and removed threads.
 * @param before - Annotations before the write.
 * @param after - Annotations after it.
 * @returns Described changes.
 */
export function describeMsfeAiAnnotationChanges(before: MsfeAiAnnotationState, after: MsfeAiAnnotationState): QuireAiSourceDescribedChange[] {
  const changes: QuireAiSourceDescribedChange[] = [];
  for (const [key, { label, annotation }] of after) {
    const previous = before.get(key)?.annotation;
    const added = annotation.messages.slice(previous?.messages.length ?? 0);
    for (const message of added) changes.push({ kind: "inserted", section: label, excerpt: clip(`${message.body}（“${annotation.quote}”）`) });
    if (previous !== undefined && previous.status !== annotation.status && annotation.status !== "detached") {
      changes.push({ kind: "edited", section: label, excerpt: clip(`${annotation.status === "resolved" ? "已解决" : "重新打开"}：“${annotation.quote}”`) });
    }
  }
  for (const [key, { label, annotation }] of before) {
    if (!after.has(key)) changes.push({ kind: "removed", section: label, excerpt: clip(`“${annotation.quote}”`) });
  }
  return changes;
}

/** @param text - Text. @returns Text on one line, clipped. */
function clip(text: string): string {
  const single = text.replace(/\s+/gu, " ").trim();
  return single.length > excerptLength ? `${single.slice(0, excerptLength)}…` : single;
}
