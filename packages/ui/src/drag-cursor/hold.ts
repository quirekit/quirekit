/**
 * Shows the grabbing cursor across the document for one drag. Captured pointers
 * otherwise keep whatever hover cursor the element under them last resolved.
 * @param ownerDocument - Document containing the drag.
 * @returns Idempotent release.
 */
export function holdQuireDragCursor(ownerDocument: Document): () => void {
  const style = ownerDocument.createElement("style");
  style.textContent = "* { cursor: grabbing !important; }";
  ownerDocument.head.append(style);
  return () => style.remove();
}
