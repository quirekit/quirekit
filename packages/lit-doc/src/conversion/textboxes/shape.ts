import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { SourceFloatingTextbox, TextboxPaint } from '../../word/drawings/textboxes/types'
import type { ProjectionContext } from '../xml/types'
import { createDrawingXml } from '../drawings/xml'
import type { TextboxChainLink } from './chains/types'

/** @param box - Complete source shape-local values and physical size. @param blocks - Prepared author content, or absent for a genuinely empty non-text shape. @param context - Shared output owner. @param offset - Physical child offset, zero for a standalone shape. @param identity - Optional group-leaf nonvisual identity. @param link - Independently validated author-chain role, absent for a single frame. @returns Native Word shape without a fabricated physical anchor. */
export function textboxShape(box: SourceFloatingTextbox, blocks: DocxXmlElementPlan[] | undefined, context: ProjectionContext,
  offset: readonly [number, number] = [0, 0], identity?: { id: number, name: string }, link?: TextboxChainLink): DocxXmlElementPlan {
  const element = createDrawingXml(context)
  /** @param source - Direct solid/no-fill appearance. @returns Canonical paint including the original opacity. */
  function paint(source: TextboxPaint): DocxXmlElementPlan {
    return source.color === null ? element('a', 'noFill') : element('a', 'solidFill', {}, [element('a', 'srgbClr', { val: source.color },
      [element('a', 'alpha', { val: Math.round(source.opacity * 100000) })])])
  }
  const extent = { cx: Math.round(box.extent[0]), cy: Math.round(box.extent[1]) }, rotation = box.rotation * 60000 / 65536
  if (!Number.isInteger(rotation) || [box.fill, box.stroke].some(value => !Number.isInteger(value.opacity * 100000)))
    context.diagnose({ code: 'textbox-units-rounded', kind: 'approximation', source: 'textbox', message: 'Textbox fixed-point rotation or opacity requires nearest-unit DrawingML rounding.' })
  return element('wps', 'wsp', {}, [...(identity ? [element('wps', 'cNvPr', identity)] : []), element('wps', 'cNvSpPr', box.textbox ? { txBox: '1' } : {},
    identity ? [element('a', 'spLocks', { noChangeAspect: box.lockAspect ? '1' : '0' })] : []),
    element('wps', 'spPr', {}, [element('a', 'xfrm', { rot: Math.round(rotation), flipH: box.flipX ? '1' : '0', flipV: box.flipY ? '1' : '0' },
      [element('a', 'off', { x: Math.round(offset[0]), y: Math.round(offset[1]) }), element('a', 'ext', extent)]), element('a', 'prstGeom', { prst: 'rect' }, [element('a', 'avLst')]),
    paint(box.fill), element('a', 'ln', { w: box.lineWidth }, [paint(box.stroke), element('a', 'prstDash', { val: 'solid' })])]),
    ...(link && link.sequence > 0 ? [element('wps', 'linkedTxbx', { id: link.id, seq: link.sequence })]
      : blocks === undefined ? [] : [element('wps', 'txbx', link ? { id: link.id } : {}, [context.element('txbxContent', {}, blocks)])]),
    element('wps', 'bodyPr', { lIns: box.insets[0], tIns: box.insets[1], rIns: box.insets[2], bIns: box.insets[3],
      anchor: box.verticalAlignment, wrap: box.wrapInside ? 'square' : 'none', rot: 0, upright: '0' }, [element('a', box.fitShape ? 'spAutoFit' : 'noAutofit')])])
}
