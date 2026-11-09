import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocNumberingDefinition, DocNumberingLevel, DocNumberingOverride } from '../../word/numbering/types'
import { styleId } from '../styles/identity'
import { numberingProperties } from './properties'
import type { NumberingLevelContext } from './types'

/**
 * Compiles one complete source tuple without authoring presets or counter evaluation.
 * @param level - Base or replacement level.
 * @param definition - Owning abstract list and its source paragraph-style links.
 * @param authority - Located definition or concrete override.
 * @param context - Shared source interpreters and bounded output owner.
 * @returns Complete OOXML level.
 */
export function projectNumberingLevel(level: DocNumberingLevel, definition: DocNumberingDefinition, authority: string,
  context: NumberingLevelContext): DocxXmlElementPlan {
  const e = context.xml.element
  const linkedStyle = definition.styleIndexes[level.index]!
  const compiled = context.levels.get(level)!
  const { pPr, rPr } = numberingProperties(compiled.properties, authority, context)
  const children: DocxXmlElementPlan[] = []
  if (level.startAt !== null) children.push(e('start', { val: level.startAt }))
  children.push(e('numFmt', { val: compiled.format }))
  if (level.restartLimit !== null) children.push(e('lvlRestart', { val: level.restartLimit }))
  if (linkedStyle !== 0xfff) children.push(e('pStyle', { val: styleId(linkedStyle) }))
  if (level.legal) children.push(e('isLgl'))
  children.push(e('suff', { val: ['tab', 'space', 'nothing'][level.suffix]! }), e('lvlText', { val: compiled.text }),
    e('lvlJc', { val: ['left', 'center', 'right'][level.alignment]! }))
  if (pPr.length) children.push(e('pPr', {}, pPr))
  if (rPr.length) children.push(e('rPr', {}, rPr))
  if (level.savedIndentTwips !== null || level.converted || level.htmlFlags)
    context.xml.diagnose({ code: 'numbering-level-metadata-unprojected', kind: 'loss', source: authority,
      message: 'Legacy removal indentation, converted-bidi and HTML metadata have no admitted equivalent in this projection.' })
  return e('lvl', { ilvl: level.index, ...(level.tentative ? { tentative: '1' } : {}) }, children)
}

/**
 * Keeps full replacement formatting separate from activation of its starting number.
 * @param override - Independently validated LFO level override.
 * @param definition - Original abstract list.
 * @param authority - Located instance identity.
 * @param context - Shared source and XML owners.
 * @returns Override element, or null when the source record has no active effect.
 */
export function projectNumberingOverride(override: DocNumberingOverride, definition: DocNumberingDefinition, authority: string,
  context: NumberingLevelContext): DocxXmlElementPlan | null {
  const e = context.xml.element
  const level = override.formatting ?? definition.levels[override.level]!
  const children: DocxXmlElementPlan[] = []
  if (override.hasStartOverride && level.startAt !== null) children.push(e('startOverride', {
    val: override.formatting ? override.formatting.startAt! : override.startOverride!,
  }))
  if (override.formatting) children.push(projectNumberingLevel(override.formatting, definition, authority, context))
  if (override.htmlFlags) context.xml.diagnose({ code: 'numbering-override-metadata-unprojected', kind: 'loss', source: authority,
    message: 'Legacy override HTML metadata is not projected.' })
  return children.length ? e('lvlOverride', { ilvl: override.level }, children) : null
}
