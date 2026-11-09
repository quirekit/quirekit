import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { SourcePictureFrame } from '../../word/pictures/types'
import { createDrawingXml } from '../drawings/xml'
import type { ProjectionContext } from '../xml/types'
import type { PictureGeometry } from './types'

/** @param picture - Original media and shape-local appearance. @param geometry - Physical target dimensions and fractions. @param key - Symbolic image relationship. @param id - Unique drawing occurrence. @param context - Bounded XML owner. @param offset - Physical offset in the real containing group. @returns Native picture without inventing an outer anchor. */
export function pictureShape(picture: SourcePictureFrame, geometry: PictureGeometry, key: string, id: number, context: ProjectionContext,
  offset: readonly [number, number] = [0, 0]): DocxXmlElementPlan {
  const e = createDrawingXml(context)
  const identity = { id, name: picture.name ?? `Picture ${id}`, ...(picture.description === null ? {} : { descr: picture.description }) }
  const crop = Object.fromEntries(['l', 't', 'r', 'b'].map((name, index) => [name, geometry.crop[index]!]))
  return e('pic', 'pic', {}, [
    e('pic', 'nvPicPr', {}, [e('pic', 'cNvPr', identity), e('pic', 'cNvPicPr', {}, [e('a', 'picLocks', { noChangeAspect: picture.lockAspect ? '1' : '0' })])]),
    e('pic', 'blipFill', {}, [e('a', 'blip', { 'r:embed': { kind: 'relationship-reference', key } }),
      e('a', 'srcRect', crop), e('a', 'stretch', {}, [e('a', 'fillRect')])]),
    e('pic', 'spPr', {}, [e('a', 'xfrm', { rot: geometry.rotation, flipH: picture.flipX ? '1' : '0', flipV: picture.flipY ? '1' : '0' },
      [e('a', 'off', { x: Math.round(offset[0]), y: Math.round(offset[1]) }), e('a', 'ext', { cx: geometry.width, cy: geometry.height })]),
    e('a', 'prstGeom', { prst: 'rect' }, [e('a', 'avLst')])]),
  ])
}
