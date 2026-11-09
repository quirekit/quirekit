import type { LitAstTextBoxLink } from './types.js'

/** @param value - Candidate JSON-safe text-box link. @returns Exact semantic link, or undefined for malformed or absent evidence. */
export function readLitAstTextBoxLink(value: unknown): LitAstTextBoxLink | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const link = value as Record<string, unknown>
  if (Object.keys(link).length !== 2 || typeof link.chainId !== 'string' || !link.chainId
    || typeof link.sequence !== 'number' || !Number.isInteger(link.sequence) || link.sequence < 0 || link.sequence > 65535) return undefined
  return { chainId: link.chainId, sequence: link.sequence }
}
