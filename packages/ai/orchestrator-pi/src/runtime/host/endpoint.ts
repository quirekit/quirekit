/**
 * Resolves one versioned Pi Provider Host endpoint.
 *
 * @param hostUrl - Host base URL.
 * @param route - Versioned route.
 * @returns Safe endpoint.
 */
export function resolveQuireAiPiHostEndpoint(
  hostUrl: string,
  route: "" | "profiles"
): string {
  let url: URL;
  try {
    url = new URL(hostUrl);
  } catch {
    throw new TypeError("Pi Provider Host URL must be valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Pi Provider Host URL must use HTTP or HTTPS.");
  }
  url.hash = "";
  url.search = "";
  const root = url.pathname.replace(/\/+$/u, "");
  url.pathname = `${root}/v1${route.length === 0 ? "" : `/${route}`}`;
  return url.toString().replace(/\/$/u, "");
}

/**
 * Resolves an injected or platform fetch implementation.
 *
 * @param injected - Optional fetch.
 * @returns Callable fetch.
 */
export function resolveQuireAiPiHostFetch(
  injected: typeof globalThis.fetch | undefined
): typeof globalThis.fetch {
  const implementation = injected ?? globalThis.fetch?.bind(globalThis);
  if (typeof implementation !== "function") {
    throw new TypeError("Pi Provider Host requires fetch.");
  }
  return implementation;
}
