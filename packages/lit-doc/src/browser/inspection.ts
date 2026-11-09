import { resolveLimits } from '../binary/limits'
import { DocReadError, requireDoc } from '../errors'
import type { DocInspection } from '../types'
import type { DocWorkerRequest, DocWorkerResponse } from '../worker/types'
import type { DocWorkerOptions } from './types'
import { runOwnedWorkerTask } from './task/run'
import { validWorkerRevisions } from './revisions'
import { validWorkerDrawings } from './drawings'
import { validWorkerTextboxes } from './textboxes'
import { validDocShading } from '../word/formatting/shading/read'

/**
 * Inspects DOC in a fresh Worker, terminating computation on cancellation or deadline.
 * @param input - Caller-owned bytes; this buffer is neither mutated nor detached.
 * @param options - Resource, cancellation, deadline and worker URL policy.
 * @returns Source inspection from the same reader used by Node.
 */
export async function inspectDocInWorker(input: Uint8Array, options: DocWorkerOptions = {}): Promise<DocInspection> {
  requireDoc(input instanceof Uint8Array && options && typeof options === 'object', 'invalid-input', 'Expected DOC bytes and worker options')
  const limits = resolveLimits(options)
  requireDoc(input.byteLength <= limits.maxInputBytes, 'limit-exceeded', 'Input byte limit exceeded')
  const timeoutMs = options.timeoutMs ?? 20000
  requireDoc(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, 'invalid-input', 'Invalid worker timeout')
  if (options.signal?.aborted) throw new DocReadError('aborted', 'DOC inspection was cancelled')
  const bytes = new Uint8Array(input)
  const request: DocWorkerRequest = { version: 1, type: 'inspect-doc', input: bytes,
    options: { limits, ...(options.includeParagraphs === undefined ? {} : { includeParagraphs: options.includeParagraphs }),
      ...(options.includeParagraphFormatting === undefined ? {} : { includeParagraphFormatting: options.includeParagraphFormatting }) } }
  if (options.includeCharacterFormatting !== undefined) request.options.includeCharacterFormatting = options.includeCharacterFormatting
  if (options.includeTables !== undefined) request.options.includeTables = options.includeTables
  if (options.includeNumbering !== undefined) request.options.includeNumbering = options.includeNumbering
  if (options.includeHeaderFooters !== undefined) request.options.includeHeaderFooters = options.includeHeaderFooters
  if (options.includeNotes !== undefined) request.options.includeNotes = options.includeNotes
  if (options.includeNoteSettings !== undefined) request.options.includeNoteSettings = options.includeNoteSettings
  if (options.includeFields !== undefined) request.options.includeFields = options.includeFields
  if (options.includeBookmarks !== undefined) request.options.includeBookmarks = options.includeBookmarks
  if (options.includeComments !== undefined) request.options.includeComments = options.includeComments
  if (options.includeRevisionAuthors !== undefined) request.options.includeRevisionAuthors = options.includeRevisionAuthors
  if (options.includeRevisions !== undefined) request.options.includeRevisions = options.includeRevisions
  if (options.includeDrawings !== undefined) request.options.includeDrawings = options.includeDrawings
  if (options.includeTextboxes !== undefined) request.options.includeTextboxes = options.includeTextboxes
  return runOwnedWorkerTask(request, [bytes.buffer], { ...(options.signal ? { signal: options.signal } : {}), timeoutMs,
    createWorker: options.createWorker ?? (() => new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' })) }, value => {
    const reply = value as DocWorkerResponse
    requireDoc(reply && reply.version === 1 && (reply.type === 'result' || reply.type === 'error'), 'worker-failed', 'Invalid DOC worker reply')
    if (reply.type === 'error') throw new DocReadError(reply.code, reply.message)
    requireDoc(reply.result?.scope === 'text-storage'
      && (!(options.includeParagraphs || options.includeParagraphFormatting || options.includeCharacterFormatting || options.includeRevisions || options.includeTables || options.includeNumbering) || Array.isArray(reply.result.paragraphs))
      && (!(options.includeParagraphFormatting || options.includeCharacterFormatting || options.includeRevisions || options.includeNumbering) || !!reply.result.paragraphs?.length
        && !reply.result.paragraphs.some(paragraph => paragraph?.baseFormat?.scope !== 'paragraph-base'
          || typeof paragraph.baseFormat.autoSpaceLatin !== 'boolean' || typeof paragraph.baseFormat.autoSpaceNumber !== 'boolean'
          || !validDocShading(paragraph.baseFormat.shading)))
      && (!(options.includeCharacterFormatting || options.includeRevisions) || Array.isArray(reply.result.characterRuns) && !!reply.result.characterRuns.length
        && !reply.result.characterRuns.some(run => run?.baseFormat?.scope !== 'character-base')),
    'worker-failed', 'Invalid DOC inspection result')
    requireDoc(!(options.includeRevisionAuthors || options.includeRevisions) || reply.result.revisionAuthors?.scope === 'revision-author-source'
      && typeof reply.result.revisionAuthors.present === 'boolean' && Array.isArray(reply.result.revisionAuthors.authors)
      && (reply.result.revisionAuthors.present || reply.result.revisionAuthors.authors.length === 0)
      && reply.result.revisionAuthors.authors.every(author => typeof author === 'string'),
    'worker-failed', 'DOC worker omitted revision-author source data')
    requireDoc(!options.includeRevisions || validWorkerRevisions(reply.result), 'worker-failed', 'DOC worker omitted complete revision source data')
    requireDoc(!options.includeDrawings || validWorkerDrawings(reply.result), 'worker-failed', 'DOC worker omitted complete drawing source data')
    requireDoc(!options.includeTextboxes || validWorkerTextboxes(reply.result, limits.maxTextboxEntries), 'worker-failed', 'DOC worker omitted complete textbox source data')
    requireDoc(!options.includeTables || Array.isArray(reply.result.tables), 'worker-failed', 'DOC worker omitted table topology')
    requireDoc(!options.includeFields || reply.result.fields?.scope === 'field-index-source'
      && Array.isArray(reply.result.fields.indexes) && reply.result.fields.indexes.length === 7,
    'worker-failed', 'DOC worker omitted field source indexes')
    requireDoc(!options.includeBookmarks || reply.result.bookmarks?.scope === 'bookmark-source'
      && Array.isArray(reply.result.bookmarks.entries), 'worker-failed', 'DOC worker omitted bookmark source indexes')
    requireDoc(!options.includeComments || reply.result.comments?.scope === 'comment-source'
      && Array.isArray(reply.result.comments.entries) && Array.isArray(reply.result.comments.authors)
      && Array.isArray(reply.result.comments.bookmarks), 'worker-failed', 'DOC worker omitted comment source indexes')
    requireDoc(!options.includeNotes || reply.result.notes?.scope === 'note-source' && Array.isArray(reply.result.notes.entries),
      'worker-failed', 'DOC worker omitted footnote/endnote source indexes')
    requireDoc(!options.includeNoteSettings || reply.result.noteSettings?.scope === 'note-settings-source'
      && Array.isArray(reply.result.noteSettings.sections), 'worker-failed', 'DOC worker omitted note settings')
    requireDoc(!options.includeHeaderFooters || reply.result.headerFooters?.scope === 'header-footer-source'
      && Array.isArray(reply.result.headerFooters.stories) && Array.isArray(reply.result.headerFooters.separators)
      && Array.isArray(reply.result.headerFooters.positions), 'worker-failed', 'DOC worker omitted header/footer source records')
    requireDoc(!options.includeNumbering || reply.result.numbering?.scope === 'numbering-source'
      && Array.isArray(reply.result.numbering.definitions) && Array.isArray(reply.result.numbering.instances)
      && !reply.result.paragraphs?.some(paragraph => !paragraph.numbering), 'worker-failed', 'DOC worker omitted numbering source records')
    return reply.result
  })
}
