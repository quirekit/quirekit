import { requireDoc } from '../../errors'
import { readFloatingDttm } from '../../word/date-time'
import { readRevisionAuthors } from '../../word/revisions'
import type { DocRevisionRun } from '../../word/revisions/types'
import type { ConversionStorySource } from '../source/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Resolves an actual source actor and allocates one target carrier identity without grouping by author/time.
 * @param source - Shared source authors and document-wide output identity authority.
 * @param run - Canonical original review metadata.
 * @param kind - Independent insertion or deletion actor.
 * @param context - Located diagnostic and output-budget owner.
 * @returns Native required identity/author attributes and optional exact floating date.
 */
export function revisionAttributes(source: ConversionStorySource, run: DocRevisionRun, kind: 'insertion' | 'deletion',
  context: ProjectionContext): Record<string, string> {
  const state = source.revisionState
  state.authors ??= readRevisionAuthors(source.table, source.header, source.limits, source.context.diagnostics)
  const actor = run[kind], author = state.authors.authors[actor.authorIndex]
  requireDoc(state.authors.present && actor.authorIndex >= 0 && author !== undefined,
    'invalid-revision-data', 'Active revision references a missing original author slot')
  const attributes: Record<string, string> = { id: String(state.nextId++), author }
  const date = actor.rawTimestamp === null ? undefined : readFloatingDttm(actor.rawTimestamp)
  if (date === null) context.diagnose({ code: 'revision-date-unprojected', kind: 'loss', source: 'revision', start: run.start, end: run.end,
    message: 'An invalid active revision DTTM is omitted; no current time, normalized date or UTC offset is invented.' })
  else if (date !== undefined) attributes.date = date
  if (actor.reason !== null && actor.reason !== 0) context.diagnose({ code: 'revision-reason-unprojected', kind: 'loss', source: 'revision', start: run.start, end: run.end,
    message: 'The non-default source edit reason has no admitted native OOXML content-revision field; source inspection retains its original value.' })
  return attributes
}

/**
 * Preserves source save-session ids on the initial run without treating them as persistent review identity.
 * @param run - Original independent save sessions, including explicit zero values.
 * @param context - Located support-boundary reporter.
 * @returns Exact eight-digit OOXML run attributes.
 */
export function revisionRunAttributes(run: DocRevisionRun, context: ProjectionContext): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const [field, name] of [['insertionSaveId', 'rsidR'], ['deletionSaveId', 'rsidDel'], ['formattingSaveId', 'rsidRPr']] as const)
    if (run[field] !== null) attributes[name] = run[field].toString(16).padStart(8, '0').toUpperCase()
  if (Object.keys(attributes).length) context.diagnose({ code: 'revision-save-session-host-limit', kind: 'host-limit', source: 'revision', start: run.start, end: run.end,
    message: 'Source save-session attributes are retained on the initial OOXML run; LitAST/Classic do not model their native edited-export persistence or business-event grouping.' })
  const inactiveActors = [...(run.inserted ? [] : [run.insertion]), ...(run.deleted ? [] : [run.deletion])]
  if (inactiveActors.some(actor => actor.authorExplicit || actor.rawTimestamp !== null || actor.reason !== null))
    context.diagnose({ code: 'inactive-revision-metadata-unprojected', kind: 'loss', source: 'revision', start: run.start, end: run.end,
      message: 'Inactive source actor/date/reason operands are not emitted as a fabricated tracked change; their original values remain inspectable.' })
  return attributes
}
