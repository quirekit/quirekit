/** Build date injected by the package build; absent when running from source. */
declare const __QUIREKIT_RELEASE_DATE__: string | undefined;

/** Location facts the license check reads. */
export interface LicenseLocation {
  /** URL scheme including the colon, such as `https:`. */ readonly protocol: string;
  /** Normalized host name. */ readonly hostname: string;
  /** Explicit port, or an empty string for the scheme default. */ readonly port: string;
}

/** Hosts packaged desktop and mobile shells serve production apps from. */
const packagedHosts = new Set(["tauri.localhost"]);

/**
 * Reads the release date of the license package build.
 * @returns `YYYY-MM-DD`, or undefined when running unbuilt source.
 */
export function releaseDate(): string | undefined {
  return typeof __QUIREKIT_RELEASE_DATE__ === "string" ? __QUIREKIT_RELEASE_DATE__ : undefined;
}

/**
 * Normalizes a host name for comparison.
 * @param hostname - Raw host name.
 * @returns Lower-case host without IPv6 brackets or a trailing dot.
 */
export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
}

/**
 * Reads the current page location.
 * @returns Location facts, or undefined outside a browser.
 */
export function currentLocation(): LicenseLocation | undefined {
  const location = (globalThis as { location?: { protocol?: unknown; hostname?: unknown; port?: unknown } }).location;
  if (typeof location?.hostname !== "string") return undefined;
  return {
    protocol: typeof location.protocol === "string" ? location.protocol : "",
    hostname: normalizeHostname(location.hostname),
    port: typeof location.port === "string" ? location.port : ""
  };
}

/**
 * Reports whether a location is a local development server, which never shows the notice.
 * Only http(s) on an explicit port counts: packaged desktop and mobile shells such as
 * Capacitor (`https://localhost`) or Tauri (`tauri://localhost`) are production.
 * @param location - Current location, if any.
 * @returns Whether the location is a loopback, `*.localhost` or `*.test` development server.
 */
export function isDevelopmentLocation(location: LicenseLocation | undefined): boolean {
  if (!location || location.port === "" || !/^https?:$/u.test(location.protocol)) return false;
  const host = location.hostname;
  if (packagedHosts.has(host)) return false;
  return host === "localhost" || host === "127.0.0.1" || host === "::1"
    || host.endsWith(".localhost") || host.endsWith(".test");
}
