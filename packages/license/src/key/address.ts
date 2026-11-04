/** Most addresses an offline sub-license may bind. */
export const maxOfflineAddresses = 5;

const ipv4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/u;
const ipv4Block = /^((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3})\*$/u;

/**
 * Reports whether a host is a dotted IPv4 address.
 * @param host - Normalized host name.
 * @returns Whether the host is IPv4.
 */
export function isIpv4(host: string): boolean {
  return ipv4.test(host);
}

/**
 * Reads the prefix of a `/24` block pattern such as `192.168.10.*`.
 * @param pattern - Normalized address pattern.
 * @returns The prefix with its trailing dot, or undefined for other patterns.
 */
export function ipv4BlockPrefix(pattern: string): string | undefined {
  return ipv4Block.exec(pattern)?.[1];
}

/**
 * Reports whether an address pattern is wider than one registrable domain or one `/24` block.
 * @param pattern - Normalized host name or pattern.
 * @returns Whether the pattern must be refused.
 */
export function isTooBroad(pattern: string): boolean {
  if (!pattern.includes("*")) return false;
  if (pattern.startsWith("*.")) return !pattern.slice(2).includes(".") || pattern.slice(2).includes("*");
  return ipv4BlockPrefix(pattern) === undefined;
}

/**
 * Checks the address binding an offline sub-license needs.
 * @param domains - Bound host names or patterns.
 * @returns Whether one to five addresses are bound and none is too broad.
 */
export function isOfflineBinding(domains: readonly string[] | undefined): boolean {
  return !!domains && domains.length > 0 && domains.length <= maxOfflineAddresses && !domains.some(isTooBroad);
}
