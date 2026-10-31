import type { QuireKitLicenseCheck, QuireKitProduct } from "../types";
import { checkQuireKitLicense, recordReleaseDate, subscribeQuireKitLicense } from "./state";

/** Product lines declared on the page, shared by every copy of this package. */
interface DeclaredProducts {
  /** Product lines in declaration order. */ readonly products: Set<QuireKitProduct>;
  /** Declaration listeners. */ readonly listeners: Set<() => void>;
}

const declaredKey = Symbol.for("quirekit.license.products.v1");

/**
 * Returns the page-wide declaration registry.
 * @returns Shared registry.
 */
function registry(): DeclaredProducts {
  const scope = globalThis as unknown as Record<symbol, DeclaredProducts | undefined>;
  return scope[declaredKey] ??= { products: new Set(), listeners: new Set() };
}

/** Options for a product declaration. */
export interface QuireKitProductDeclaration {
  /** Release date of the declaring package, `YYYY-MM-DD`; omitted while running from source. */
  readonly releaseDate?: string | undefined;
}

/**
 * Declares product lines a commercial plugin uses, so one shared notice can cover them all.
 * @param products - Product lines the plugin belongs to.
 * @param options - Release date of the declaring package.
 */
export function declareQuireKitProducts(products: readonly QuireKitProduct[], options: QuireKitProductDeclaration = {}): void {
  const declared = registry(), before = declared.products.size;
  for (const product of products) {
    declared.products.add(product);
    if (options.releaseDate) recordReleaseDate(product, options.releaseDate);
  }
  if (declared.products.size !== before) for (const listener of declared.listeners) listener();
}

/**
 * Checks every declared product line.
 * @returns Unlicensed product lines with their results, in declaration order.
 */
export async function checkDeclaredQuireKitProducts(): Promise<readonly { readonly product: QuireKitProduct; readonly check: QuireKitLicenseCheck }[]> {
  const products = [...registry().products];
  const checks = await Promise.all(products.map((product) => checkQuireKitLicense(product)));
  return products.map((product, index) => ({ product, check: checks[index]! })).filter(({ check }) => check.status !== "licensed");
}

/**
 * Subscribes to key changes and newly declared product lines.
 * @param listener - Called after either change.
 * @returns Unsubscribe function.
 */
export function subscribeQuireKitProducts(listener: () => void): () => void {
  const declared = registry();
  declared.listeners.add(listener);
  const stopKey = subscribeQuireKitLicense(listener);
  return () => { declared.listeners.delete(listener); stopKey(); };
}
