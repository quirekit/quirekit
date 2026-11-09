/**
 * Distinguishes content-size observation from viewport changes that can alter CSS.
 * @param root - Mounted owner whose window drives media-query changes.
 * @param surface - Content surface that can report an already committed height.
 * @param onResize - Geometry invalidation, with true only for passive element observations.
 * @returns Idempotent listener and observer cleanup.
 */
export function bindHtmlResizeEvents(root: HTMLElement, surface: HTMLElement,
  onResize: (passive: boolean) => void): () => void {
  const window = root.ownerDocument.defaultView;
  const observer = window?.ResizeObserver ? new window.ResizeObserver(() => onResize(true)) : undefined;
  observer?.observe(surface);
  /** Invalidates even when media-query layout changes preserve the surface dimensions. */
  const viewportChanged = (): void => onResize(false);
  window?.addEventListener("resize", viewportChanged);
  let destroyed = false;
  return () => {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    window?.removeEventListener("resize", viewportChanged);
  };
}
