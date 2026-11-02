import type { MsfeDisplayImage, MsfeImageSourceBinding, MsfeImageSourceResolver } from "./types";

/**
 * Shows stored addresses in `image` through the host resolver; `data:` URLs and a missing resolver are used directly.
 * A failed resolution shows the stored address so the browser reports the broken image.
 * @param image - Element owned by the calling preview.
 * @param resolve - Host address mapping.
 * @returns Binding the preview updates with each accepted source.
 */
export function bindImageSource(image: HTMLImageElement, resolve: MsfeImageSourceResolver | undefined): MsfeImageSourceBinding {
  let current: string | null = null, pending: AbortController | undefined, release: (() => void) | undefined;
  /** @param url - Address to show. @param next - Release owned by that address. */
  function show(url: string | null, next?: () => void): void {
    release?.(); release = next;
    if (url === null) image.removeAttribute("src");
    else if (image.getAttribute("src") !== url) image.src = url;
  }
  return {
    set(source) {
      if (source === current) return;
      current = source; pending?.abort(); pending = undefined;
      if (source === null || !resolve || source.startsWith("data:")) { show(source); return; }
      const controller = pending = new AbortController();
      void Promise.resolve().then(() => resolve(source, controller.signal)).then((result: string | MsfeDisplayImage) => {
        const resource = typeof result === "string" ? { url: result } : result;
        if (controller.signal.aborted) resource.release?.();
        else show(resource.url, resource.release);
      }, () => {
        if (!controller.signal.aborted) show(source);
      });
    },
    destroy() { pending?.abort(); pending = undefined; current = null; release?.(); release = undefined; },
  };
}
