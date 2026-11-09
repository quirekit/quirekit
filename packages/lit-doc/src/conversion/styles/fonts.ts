import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { WordFontRecord } from '../../word/fonts/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Retains source font identity and OOXML substitution descriptors without acquiring fonts.
 * @param fonts - Complete source FFN records in index order.
 * @param context - Bounded XML and diagnostic owner.
 * @returns Typed fontTable root.
 */
export function projectFontTable(fonts: readonly WordFontRecord[], context: ProjectionContext): DocxXmlElementPlan {
  const e = context.element
  return e('fonts', {}, fonts.map((font, index) => {
    if (font.namePadding) context.diagnose({ code: 'font-name-zero-padding', kind: 'compatibility', source: `font:${index}`,
      message: `The source font record retains ${font.namePadding} zero code units after its complete names; output preserves the named font and descriptors.` })
    const children = [
      ...(font.alternateName === undefined ? [] : [e('altName', { val: font.alternateName })]),
      e('panose1', { val: font.panose.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase() }),
      e('charset', { val: font.charset.toString(16).padStart(2, '0').toUpperCase() }),
      e('family', { val: ['auto', 'roman', 'swiss', 'modern', 'script', 'decorative'][font.family]! }),
      e('notTrueType', { val: font.trueType ? '0' : '1' }),
      e('pitch', { val: ['default', 'fixed', 'variable'][font.pitch]! }),
      e('sig', Object.fromEntries(['usb0', 'usb1', 'usb2', 'usb3', 'csb0', 'csb1'].map((name, i) => [name, font.signature[i]!.toString(16).padStart(8, '0').toUpperCase()]))),
    ]
    if (font.weight !== 400) context.diagnose({ code: 'font-weight-descriptor-unprojected', kind: 'loss', source: `font:${index}`,
      message: `Font substitution weight ${font.weight} has no fontTable descriptor counterpart; run bold remains separately projected.` })
    return e('font', { name: font.name }, children)
  }))
}
