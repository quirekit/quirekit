import type { DocReadDiagnostic } from '../../types'
import { DocReadError } from '../../errors'
import { recoverStorySource } from '../source/policy'
import { readStoryTables } from '../source/tables'
import { readHeaderFooterRecords } from '../../word/header-footer/read'
import { readStoryFormatting } from '../source/story'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import type { HeaderFooterInput } from './types'

/**
 * Validates header ownership and reads its aggregate once with remaining document allocations.
 * @param source - Already verified main document and shared property budget.
 * @param context - Output policy and located refusal owner.
 * @returns Optional directory and content, with every omission explicitly diagnosed.
 */
export function readHeaderFooterInput(source: ConversionSource, context: ProjectionContext): HeaderFooterInput {
  const aggregate = source.header.stories[2]!
  const refusals = new Map<number, DocReadError>()
  const diagnostics: DocReadDiagnostic[] = []
  let directory
  try { directory = readHeaderFooterRecords(source.table, source.header, source.storage, source.limits, diagnostics) } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'header-footer-directory-unprojected', kind: 'loss', source: 'story:header',
      start: aggregate.start, end: aggregate.end, message: `Header/footer directory is omitted (${error.code}: ${error.message}).` })
    return { directory: null, content: null, refusals }
  }
  for (const diagnostic of diagnostics) context.diagnose({ ...diagnostic, kind: 'compatibility', source: 'story:header' })
  if (directory.separators.some(range => range.start < range.contentEnd)) context.diagnose({
    code: 'note-separators-unprojected', kind: 'loss', source: 'story:header',
    start: aggregate.start, end: directory.stories[0]!.start,
    message: 'Footnote and endnote separator stories require their note owners and are not yet projected.' })
  if (!directory.stories.some(range => range.start < range.contentEnd)) return { directory, content: null, refusals }
  try {
    const formatting = readStoryFormatting(source, aggregate)
    return { directory, content: readStoryTables(formatting, directory.stories, refusals, context), refusals }
  } catch (error) {
    if (!recoverStorySource(error, context)) throw error
    context.diagnose({ code: 'header-footer-source-unprojected', kind: 'loss', source: 'story:header',
      start: aggregate.start, end: aggregate.end, message: `Header/footer source formatting could not be resolved (${error.code}: ${error.message}).` })
    return { directory, content: null, refusals }
  }
}
