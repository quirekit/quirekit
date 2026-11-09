import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { ByteView } from '../../binary/bytes'
import { readUtf16Units } from '../../binary/strings'
import { requireDoc } from '../../errors'
import { applyCharacterValue } from '../../word/characters/formatting/values'
import { copyCharacterFormat, defaultCharacterFormat } from '../../word/characters/formatting/defaults'
import { characterToggleField } from '../../word/characters/formatting/toggles'
import { createCharacterStyles } from '../../word/characters/formatting/styles'
import type { CharacterPropertyKey } from '../../word/characters/formatting/types'
import { applyParagraphProperties } from '../../word/paragraphs/formatting/apply'
import { copyParagraphFormat, defaultParagraphFormat } from '../../word/paragraphs/formatting/defaults'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'
import { characterProperties, styleToggles } from '../properties/characters'
import { paragraphProperties } from '../properties/paragraphs'
import type { NumberingProjection } from '../numbering/types'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { styleId } from './identity'
import type { StyleProjection } from './types'

/**
 * Projects definitions and basedOn links while keeping direct content layers separate.
 * @param source - Canonical styles and bounded source interpreters.
 * @param context - Typed XML and complete conversion-report owner.
 * @param numbering - Complete admitted numbering graph and its style-local deltas.
 * @returns Complete styles part and source snapshots for contextual style compensation.
 */
export function projectStyles(source: ConversionSource, context: ProjectionContext, numbering?: NumberingProjection): StyleProjection {
  const e = context.element
  const { styles, reader } = source.context
  const text = createCharacterStyles(source.context, source.limits)
  const paragraph = source.paragraphStyles
  const defaults = defaultCharacterFormat(0, source.context.fonts!)
  const characterFields = new Set(Object.keys(defaults).filter(key => !['scope', 'paragraphStyleIndex', 'characterStyleIndex', 'fontIndexes', 'unsupportedOpcodes'].includes(key)) as CharacterPropertyKey[])
  for (const slot of ['ascii', 'other', 'eastAsia', 'complex'] as const) characterFields.add(`font:${slot}`)
  const paragraphDefaults = defaultParagraphFormat(0)
  const paragraphFields = new Set(Object.keys(paragraphDefaults).filter(key => !['scope', 'styleIndex', 'unsupportedOpcodes'].includes(key)) as ParagraphPropertyKey[])
  const roots: DocxXmlElementPlan[] = [e('docDefaults', {}, [
    e('rPrDefault', {}, [e('rPr', {}, characterProperties(defaults, characterFields, source.fonts, context, 'defaults:character'))]),
    e('pPrDefault', {}, [e('pPr', {}, paragraphProperties(paragraphDefaults, paragraphFields, context, 'defaults:paragraph'))]),
  ])]
  const result: StyleProjection = { root: e('styles'), normal: text.paragraph(0), paragraphs: new Map(), characters: new Map() }
  const paragraphSnapshots = result.paragraphs as Map<number, typeof defaults>
  const characterSnapshots = result.characters as Map<number, typeof defaults>

  // Preserve named definitions before content references are emitted. Source
  // literal toggles are encoded against their actual parent, never flattened.
  for (let index = 0; index < styles.length; index++) {
    const style = styles[index]
    if (!style) continue
    validateLinks(source, index)
    const authority = `style:${index}`
    if (style.metadataBytes.some(byte => byte !== 0)) context.diagnose({ code: 'style-control-metadata-unprojected', kind: 'loss', source: authority,
      message: 'Style control metadata, including links, visibility, priority and revision identities, is not yet projected.' })
    const children: DocxXmlElementPlan[] = [e('name', { val: readUtf16Units(new ByteView(style.nameBytes, 'invalid-formatting-data'), 0, style.nameBytes.length / 2) })]
    if (style.parent !== 0xfff) children.push(e('basedOn', { val: styleId(style.parent) }))
    if (style.kind === 1 && style.next !== 0xfff) children.push(e('next', { val: styleId(style.next) }))
    if (style.kind === 1 || style.kind === 2) {
      const parent = style.kind === 1
        ? style.parent === 0xfff ? defaults : text.paragraph(style.parent)
        : style.parent === 0xfff ? result.normal : text.character(result.normal, style.parent)
      const format = copyCharacterFormat(parent)
      const fields = new Set<CharacterPropertyKey>()
      const toggles = new Map<import('../../word/characters/types').CharacterToggleField, number>()
      const operations = reader.read(style.character, style.kind === 1 ? 'paragraph-character' : 'character'); reader.consume(operations.length)
      for (const operation of operations) {
        const field = applyCharacterValue(format, parent, operation, source.context.diagnostics)
        if (field) fields.add(field)
        const toggle = characterToggleField(operation.opcode)
        if (toggle) toggles.set(toggle, operation.operand[0]!)
      }
      for (const [field, mode] of toggles) {
        if (styleToggles.has(field) && mode < 0x80) context.diagnose({ code: 'literal-style-toggle-approximated', kind: 'approximation', source: authority,
          message: `Absolute source ${field} is encoded relative to its current style parent; future parent edits follow OOXML toggle semantics.` })
        if (!styleToggles.has(field)) {
          if (mode === 0x80) fields.delete(field)
          else if (mode === 0x81) context.diagnose({ code: 'relative-literal-style-toggle-approximated', kind: 'approximation', source: authority,
            message: `Source inverse-style ${field} uses an explicit current OOXML value; future parent edits cannot retain inverse inheritance.` })
        }
      }
      if (style.kind === 1) {
        const ownParagraph = style.parent === 0xfff ? defaultParagraphFormat(index) : copyParagraphFormat(paragraph.resolve(style.parent))
        const ownFields = new Set<ParagraphPropertyKey>()
        applyParagraphProperties(ownParagraph, reader.read(style.paragraph, 'paragraph'), reader, ownFields)
        const pPr = paragraphProperties(ownParagraph, ownFields, context, authority, numbering?.style(index))
        if (pPr.length) children.push(e('pPr', {}, pPr))
        diagnoseUnsupported(ownParagraph.unsupportedOpcodes.filter(code => !numbering?.handled || code !== 0x460b && code !== 0x260a), authority, context)
        paragraphSnapshots.set(index, text.paragraph(index))
      } else characterSnapshots.set(index, text.character(result.normal, index))
      const rPr = characterProperties(format, fields, source.fonts, context, authority, parent)
      if (rPr.length) children.push(e('rPr', {}, rPr))
      diagnoseUnsupported(format.unsupportedOpcodes, authority, context)
      if (style.propertySets.length > (style.kind === 1 ? 2 : 1)) context.diagnose({ code: 'style-revision-unprojected', kind: 'loss', source: authority,
        message: 'Style revision metadata is omitted; current admitted properties remain projected.' })
    } else if (style.propertySets.some(bytes => bytes.length > 0)) context.diagnose({ code: 'table-or-list-style-unprojected', kind: 'loss', source: authority,
      message: 'Table/numbering style identity is retained; its kind-specific property sets require a later projection.' })
    roots.push(e('style', { type: ['paragraph', 'character', 'table', 'numbering'][style.kind - 1]!, styleId: styleId(index),
      ...(index === 0 || index === 10 || index === 11 ? { default: '1' } : {}), ...(style.builtinId === 0xffe ? { customStyle: '1' } : {}) }, children))
  }
  if (!styles[10]) roots.push(e('style', { type: 'character', styleId: styleId(10), default: '1' }, [e('name', { val: 'Default Paragraph Font' })]))
  return { ...result, root: e('styles', {}, roots) }
}

/**
 * Validates persistent definition links independently of the selected body styles.
 * @param source - Original definitions and depth policy.
 * @param index - Definition being projected.
 */
function validateLinks(source: ConversionSource, index: number): void {
  const styles = source.context.styles
  const initial = styles[index]!
  const seen = new Set<number>()
  for (let slot = index; slot !== 0xfff;) {
    requireDoc(!seen.has(slot), 'invalid-formatting-data', 'Cyclic style projection links')
    requireDoc(seen.size < source.limits.maxFormattingDepth, 'limit-exceeded', 'Style projection depth exceeded')
    if (slot === 10 && initial.kind === 2 && !styles[slot]) break
    const current = styles[slot]
    requireDoc(current?.kind === initial.kind, 'invalid-formatting-data', 'Style projection parent has an invalid kind or slot')
    seen.add(slot); slot = current.parent
  }
  if (initial.kind === 1 && initial.next !== 0xfff) requireDoc(styles[initial.next]?.kind === 1, 'invalid-formatting-data', 'Invalid next paragraph style')
}

/**
 * Reports ordinary unprojected operations without pretending raw binary data is XML preservation.
 * @param codes - Canonical source diagnostics.
 * @param source - Owning source authority.
 * @param context - Report owner.
 */
export function diagnoseUnsupported(codes: readonly number[], source: string, context: ProjectionContext): void {
  if (codes.length) context.diagnose({ code: 'source-properties-unprojected', kind: 'loss', source,
    message: `Source operations ${codes.map(code => `0x${code.toString(16)}`).join(', ')} are outside the admitted OOXML projection.` })
}
