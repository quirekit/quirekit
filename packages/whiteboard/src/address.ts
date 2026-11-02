/**
 * @param value - Untrusted stored address.
 * @returns The address when it is `http(s)`, site-relative, or relative to the document without leaving its folder;
 * other schemes, protocol-relative addresses and `..` segments are rejected.
 */
export function previewAddress(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 2048 || /[\s\\"'<>`]/u.test(value)) throw new TypeError("preview: invalid address");
  if (/^https?:\/\/[^/?#]+/iu.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value) || value.startsWith("//")) throw new TypeError("preview: address must be http(s) or relative");
  if (/^[?#]/u.test(value) || value.split(/[?#]/u)[0]!.split("/").includes("..")) throw new TypeError("preview: relative address must name a file inside the document folder");
  return value;
}
