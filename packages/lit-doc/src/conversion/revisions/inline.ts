import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { revisionAttributes, revisionRunAttributes } from './metadata'
import type { InlineRevisionProjection } from './types'

/**
 * Preflights native text review before any child resource is projected by its own owner.
 * @param source - Canonical source operations, stored text and shared review identities.
 * @param index - Character-source run slot.
 * @param start - Actual first source CP of this output fragment.
 * @param end - Exclusive fragment CP, before its paragraph mark.
 * @param inField - Whether a field/code/cache owner is already open at the fragment start.
 * @param context - Located budget and explicit loss policy.
 * @returns Native review wrapper plan without bypassing field or resource admission.
 */
export function projectInlineRevision(source: ConversionSource, index: number, start: number, end: number, inField: boolean,
  context: ProjectionContext): InlineRevisionProjection {
  const run = source.runRevisions[index]!, attributes = revisionRunAttributes(run, context)
  const unchanged = { handled: false, attributes, wrap: (value: DocxXmlElementPlan) => value }
  if (!run.inserted && !run.deleted) return { ...unchanged, handled: true }
  // A native text mark cannot own another feature's structural controls or a
  // second simultaneous review state. Those contexts keep their existing owner.
  if (start >= source.header.stories[0]!.end || run.inserted && run.deleted || inField
    || /[\u0001\u0002\u0005\u0008\u000c\u000e\u0013-\u0015]/u.test(source.storage.text.slice(start, end))) {
    context.diagnose({ code: 'revision-content-unprojected', kind: 'loss', source: 'revision', start, end,
      message: 'Auxiliary Stories, dual review states, field-owned content and resource/structural controls require their own revision lifecycle; stored content keeps its existing owner without an opaque wrapper.' })
    return unchanged
  }
  const kind = run.deleted ? 'deletion' : 'insertion', identity = revisionAttributes(source, run, kind, context)
  return { handled: true, attributes,
    /** @param value - Complete admitted text run. @returns Native source revision and its original text payload. */
    wrap(value) {
      const child = run.deleted ? { ...value, children: value.children.map(item => typeof item !== 'string' && item.localName === 't'
        ? { ...item, localName: 'delText' } : item) } : value
      return context.element(run.deleted ? 'del' : 'ins', identity, [child])
    } }
}
