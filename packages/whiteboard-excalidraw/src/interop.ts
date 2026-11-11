/**
 * Reads a CommonJS package loaded with `import()`. Bundlers differ in what the namespace holds: some copy
 * the exports onto it, while others (such as esbuild with code splitting) expose them only as `default`.
 * @param module - Namespace returned by the dynamic import.
 * @param member - An export the caller needs, which tells the two shapes apart.
 * @returns The object that carries the package's exports.
 */
export function commonJsExports<T extends object>(module: T, member: keyof T & string): T {
  return member in module ? module : (module as unknown as { readonly default: T }).default;
}
