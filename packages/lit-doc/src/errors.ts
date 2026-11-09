import type { DocReadErrorCode } from './types'

/** A bounded-reader failure that can be passed across worker boundaries. */
export class DocReadError extends Error {
  /** Stable machine-readable failure category. */
  readonly code: DocReadErrorCode

  /**
   * Creates a document-reading failure without retaining the original file.
   * @param code - Stable category.
   * @param message - Description of the violated condition.
   */
  constructor(code: DocReadErrorCode, message: string) {
    super(message)
    this.name = 'DocReadError'
    this.code = code
  }
}

/**
 * Checks a condition before consuming or allocating untrusted data.
 * @param condition - Required invariant.
 * @param code - Failure category.
 * @param message - Reason the input cannot be consumed.
 */
export function requireDoc(condition: unknown, code: DocReadErrorCode, message: string): asserts condition {
  if (!condition) throw new DocReadError(code, message)
}
