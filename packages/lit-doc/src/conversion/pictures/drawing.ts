import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { SourcePictureFrame } from '../../word/pictures/types'
import type { FloatingPicturePlacement } from '../../word/drawings/pictures/types'
import type { ProjectionContext } from '../xml/types'
import { floatingDrawingAnchor } from '../drawings/anchor'
import { createDrawingXml, drawingNamespaces } from '../drawings/xml'
import { pictureShape } from './shape'
import type { PictureGeometry } from './types'

/** @param picture - Validated source occurrence. @param context - Located rounding report owner. @returns Canonical target dimensions and fractions. */
export function pictureGeometry(picture: SourcePictureFrame, context: ProjectionContext): PictureGeometry {
  const values = [picture.initialWidth * picture.scaleX * 635 / 1000, picture.initialHeight * picture.scaleY * 635 / 1000,
    ...picture.crop.map(value => value * 100000 / 65536), picture.rotation * 60000 / 65536]
  if (values.some(value => !Number.isInteger(value))) context.diagnose({ code: 'picture-units-rounded', kind: 'approximation', source: 'picture',
    message: 'Source fixed-point dimensions, crop or rotation require rounding to the nearest DrawingML unit.' })
  const rounded = values.map(Math.round)
  return { width: rounded[0]!, height: rounded[1]!, crop: rounded.slice(2, 6), rotation: rounded[6]! }
}

/** @param picture - Validated source media occurrence. @param geometry - Converted target units. @param key - Symbolic relationship identity. @param id - Independent drawing occurrence identity. @param context - Shared bounded namespace-aware XML owner. @param placement - Original floating tuple, absent for inline pictures. @returns Complete Word drawing with one occurrence-specific wrapper. */
export function pictureDrawing(picture: SourcePictureFrame, geometry: PictureGeometry, key: string, id: number, context: ProjectionContext,
  placement?: FloatingPicturePlacement): DocxXmlElementPlan {
  const element = createDrawingXml(context)
  const extent = { cx: geometry.width, cy: geometry.height }
  const identity = { id, name: picture.name ?? `Picture ${id}`, ...(picture.description === null ? {} : { descr: picture.description }) }
  const lock = { noChangeAspect: picture.lockAspect ? '1' : '0' }
  const pictureNode = pictureShape(picture, geometry, key, id, context)
  if (placement) return floatingDrawingAnchor({ id, name: identity.name, description: picture.description,
    extent: [geometry.width, geometry.height], placement, lockAspect: picture.lockAspect,
    graphicNamespace: drawingNamespaces.pic, children: [pictureNode] }, context)
  const content = [
    element('wp', 'extent', extent), element('wp', 'docPr', identity),
    element('wp', 'cNvGraphicFramePr', {}, [element('a', 'graphicFrameLocks', lock)]),
    element('a', 'graphic', {}, [element('a', 'graphicData', { uri: drawingNamespaces.pic }, [pictureNode])]),
  ]
  return context.element('drawing', {}, [element('wp', 'inline', { distT: 0, distB: 0, distL: 0, distR: 0 }, content)])
}
