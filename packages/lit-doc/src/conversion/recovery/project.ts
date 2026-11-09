import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { DocReadError } from '../../errors'
import type { WordDocumentSource } from '../../word/document/types'
import type { DocSourcePlanResult } from '../types'
import type { ConversionSource } from '../source/types'
import { officeRelationships, wordPart } from '../xml/parts'
import type { ProjectionContext } from '../xml/types'
import { createTextRecoveryFields } from './fields'

/**
 * Builds an ordinary editable body from independently validated source text.
 * @param source - Immutable text snapshot acquired before rich interpretation.
 * @param context - Shared report and remaining XML work budget.
 * @param error - Located rich-source failure triggering this single recovery.
 * @param rich - Complete rich source when projection failed after its acquisition.
 * @returns Minimal typed package graph with an explicit recovery report.
 */
export function projectRecoveredText(source: WordDocumentSource, context: ProjectionContext, error: DocReadError, rich?: ConversionSource): DocSourcePlanResult {
  const original = source.header.stories[0]!, story = source.storage.recoveredRange ?? original, raw = source.storage.text
  const offset = source.storage.recoveredRange?.start ?? 0
  context.report.source.sections = 0
  context.report.recovery = { level: 'text', cause: error.code,
    ...(source.storage.recoveredRange ? { mainStoryRange: source.storage.recoveredRange } : {}),
    unresolvedTextSemantics: rich ? [] : ['hidden-formatting', 'tracked-changes'],
    unmeasuredSourceCounts: rich ? ['sections'] : ['paragraphs', 'characterRuns', 'tables', 'styles', 'fonts', 'sections'] }
  context.diagnose({ code: 'document-text-recovered', kind: 'loss', source: 'document', start: story.start, end: story.end,
    message: `Rich source interpretation failed with ${error.code}. ${error.message}. Validated main-story text is recovered as ordinary paragraphs with formatting, structure and objects omitted.` })
  if (story.start > original.start || story.end < original.end) context.diagnose({
    code: 'text-recovery-main-story-incomplete', kind: 'loss', source: 'main', start: story.start, end: story.end,
    message: `The retained main-story range is [${story.start}, ${story.end}); the declared complete range is [${original.start}, ${original.end}). Missing source characters are omitted.` })
  for (const other of source.header.stories.slice(1)) if (other.end > other.start) context.diagnose({
    code: 'story-unprojected', kind: 'loss', source: `story:${other.kind}`, start: other.start, end: other.end,
    message: 'This auxiliary Story is omitted during main-story text recovery.' })
  if (!rich) context.diagnose({ code: 'text-recovery-visibility-unresolved', kind: 'loss', source: 'characters',
    message: 'Recovered stored text has unresolved hidden formatting and tracked-change state because complete character runs could not be acquired.' })
  else if (rich.runs.some(run => run.baseFormat.inserted || run.baseFormat.deleted)) context.diagnose({
    code: 'text-recovery-revisions-flattened', kind: 'loss', source: 'revision',
    message: 'Text recovery retains insertion text and omits deleted text using resolved source runs. Revision objects and metadata are omitted.' })
  const omitted = rich?.runs.filter(run => run.baseFormat.hidden || run.baseFormat.deleted) ?? []
  let omittedIndex = 0
  const fields = createTextRecoveryFields(source, context)
  const paragraphs: DocxXmlElementPlan[] = []
  let runs: DocxXmlElementPlan[] = [], start = story.start

  /** @param child - Already budgeted ordinary text, tab or manual break. */
  function append(child: DocxXmlElementPlan): void { runs.push(context.element('r', {}, [child])) }
  /** @param end - First CP outside the contiguous source span preceding a control. */
  function flushText(end: number): void {
    if (!fields.visible || end <= start) return
    let position = start
    while (omittedIndex < omitted.length && omitted[omittedIndex]!.end <= position) omittedIndex++
    while (omittedIndex < omitted.length && omitted[omittedIndex]!.start < end) {
      const run = omitted[omittedIndex]!
      if (position < run.start) append(context.element('t', {}, [raw.slice(position - offset, Math.min(run.start, end) - offset)]))
      context.diagnose({ code: run.baseFormat.hidden ? 'text-recovery-hidden-content-omitted' : 'text-recovery-deleted-content-omitted',
        kind: 'loss', source: 'characters', start: Math.max(position, run.start), end: Math.min(end, run.end),
        message: 'Resolved hidden or deleted source characters are omitted from the recovered ordinary body.' })
      position = Math.max(position, run.end)
      if (run.end > end) break
      omittedIndex++
    }
    if (position < end) append(context.element('t', {}, [raw.slice(position - offset, end - offset)]))
  }
  /** Installs one ordinary paragraph under both source and XML ceilings. */
  function flushParagraph(): void {
    requireDoc(paragraphs.length < source.limits.maxParagraphs, 'limit-exceeded', 'Text recovery paragraph limit exceeded')
    paragraphs.push(context.element('p', {}, runs))
    runs = []
  }

  // Recovery uses ordinary body structure. Validated text CPs, known visibility
  // and field ownership delimit output, while table/section controls become breaks.
  for (let position = story.start; position < story.end; position++) {
    const code = raw.charCodeAt(position - offset)
    if (code >= 32) continue
    flushText(position)
    start = position + 1
    if (code === 19 || code === 20 || code === 21) { fields.control(position, code); continue }
    if (!fields.visible) continue
    if (code === 13 || code === 7 || code === 12) flushParagraph()
    else if (code === 9 || code === 11) append(context.element(code === 9 ? 'tab' : 'br'))
    else if (code === 30 || code === 31) append(context.element('t', {}, [code === 30 ? '\u2011' : '\u00ad']))
    else if ([1, 2, 5, 8].includes(code)) context.diagnose({ code: 'text-recovery-object-omitted', kind: 'loss', source: 'main',
      start: position, end: position + 1, message: 'A source object or auxiliary reference is omitted during ordinary-text recovery.' })
    else append(context.element('t', {}, [raw[position - offset]!]))
  }
  flushText(story.end)
  fields.finish()
  if (runs.length || !paragraphs.length) flushParagraph()
  const root = context.element('document', {}, [context.element('body', {}, paragraphs)])
  return { plan: { resources: [], parts: [wordPart('/word/document.xml', 'document.main', root)], relationships: [{
    key: 'document', sourcePart: '/', relationshipType: `${officeRelationships}officeDocument`, target: '/word/document.xml', targetMode: 'internal',
  }] }, report: context.report }
}
