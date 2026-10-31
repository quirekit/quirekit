import { setValue, value, type Session } from "@earendil-works/pi-agent-core";
import { BACKGROUND_CONTEXT } from "@earendil-works/pi-agent-core/harness/context";
import { QuireAiPiError } from "../errors";

const documentIdentity = value<string>("quirekit.document", "identity");

/**
 * Binds native history to its application document before any provider egress.
 * @param session - Native conversation storage.
 * @param documentId - Stable identity supplied by the public Document SDK.
 * @returns Completion of the atomic identity check or first binding.
 */
export async function bindSessionDocument(session: Session, documentId: string): Promise<void> {
  await session.mutate(async (mutation) => {
    const existing = await mutation.getValue(documentIdentity, BACKGROUND_CONTEXT);
    if (existing !== undefined && existing.value !== documentId) {
      throw new QuireAiPiError("document-mismatch", "This conversation belongs to a different document. Start a new conversation.");
    }
    if (existing === undefined) await mutation.commit([setValue(documentIdentity, documentId)], BACKGROUND_CONTEXT);
  }, BACKGROUND_CONTEXT);
}
