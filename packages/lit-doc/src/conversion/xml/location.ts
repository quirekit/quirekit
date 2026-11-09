import type { ProjectionContext } from './types'

/**
 * Adds the first relevant source CP range while the root owner aggregates repeated decisions.
 * @param context - Shared XML budget and report owner.
 * @param start - Inclusive source CP.
 * @param end - Exclusive source CP.
 * @returns Lightweight located view without separate counters or report storage.
 */
export function withSourceRange(context: ProjectionContext, start: number, end: number): ProjectionContext {
  return { ...context, diagnose(diagnostic) { context.diagnose({ ...diagnostic, start: diagnostic.start ?? start, end: diagnostic.end ?? end }) } }
}
