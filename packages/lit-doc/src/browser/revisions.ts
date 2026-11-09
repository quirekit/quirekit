import type { DocInspection } from '../types'

/** @param value - Untrusted optional source operand. @returns Whether it is null or an exact unsigned 32-bit value. */
function unsigned(value: unknown): boolean { return value === null || Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff }

/**
 * Checks the complete requested revision graph against the independently returned character intervals.
 * @param result - Worker result, before trusting its optional revision data.
 * @returns Whether all author and run fields form the requested complete source graph.
 */
export function validWorkerRevisions(result: DocInspection): boolean {
  const source = result.revisions, runs = result.characterRuns, authors = result.revisionAuthors, main = result.stories?.[0]
  if (source?.scope !== 'main-story-revision-source' || !runs || !Array.isArray(source.runs)
    || source.runs.length !== runs.length || source.authors?.scope !== 'revision-author-source'
    || typeof source.authors.present !== 'boolean' || !Array.isArray(source.authors.authors)
    || !source.authors.authors.every(name => typeof name === 'string')
    || !source.authors.present && source.authors.authors.length > 0 || !authors || !main
    || source.authors.present !== authors.present || source.authors.authors.length !== authors.authors.length
    || source.authors.authors.some((name, index) => name !== authors.authors[index])
    || source.runs[0]?.start !== main.start || source.runs.at(-1)?.end !== main.end) return false
  return source.runs.every((run, index) => {
    const character = runs[index]
    return run && character && run.start === character.start && run.end === character.end
      && Number.isSafeInteger(run.start) && Number.isSafeInteger(run.end) && run.end > run.start
      && (index === 0 || source.runs[index - 1]?.end === run.start)
      && typeof run.inserted === 'boolean' && typeof run.deleted === 'boolean'
      && run.inserted === character.baseFormat.inserted && run.deleted === character.baseFormat.deleted
      && unsigned(run.insertionSaveId) && unsigned(run.deletionSaveId) && unsigned(run.formattingSaveId)
      && [run.insertion, run.deletion].every(actor => actor && Number.isInteger(actor.authorIndex)
        && actor.authorIndex >= -0x8000 && actor.authorIndex < 0x8000 && typeof actor.authorExplicit === 'boolean'
        && unsigned(actor.rawTimestamp) && (actor.reason === null || Number.isInteger(actor.reason) && actor.reason >= 0 && actor.reason <= 0xffff))
  })
}
