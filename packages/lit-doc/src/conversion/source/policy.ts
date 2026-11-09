import { DocReadError } from '../../errors'
import type { ProjectionContext } from '../xml/types'

const sourceRefusals = new Set(['invalid-story-data', 'invalid-paragraph-data', 'invalid-formatting-data',
  'unsupported-formatting', 'invalid-table-data', 'unsupported-table', 'invalid-field-data', 'unsupported-field', 'invalid-comment-data'])

/** @param error - Caught source error. @param context - Explicit loss policy. @returns Whether a known optional source refusal can be diagnosed. */
export function recoverStorySource(error: unknown, context: ProjectionContext): error is DocReadError {
  return error instanceof DocReadError && sourceRefusals.has(error.code) && context.report.lossPolicy === 'best-effort'
}
