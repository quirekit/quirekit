import { requireDoc } from '../../../errors'
import { compileOfficeArtProperties } from '../../office-art/effective'
import { readOfficeArtRecords } from '../../office-art/records'
import type { OfficeArtEffectiveProperties } from '../../office-art/types'
import type { PictureReadContext, SourcePictureFrame } from '../../pictures/types'
import { readFloatingPictureAssociation } from '../pictures/association'
import { readFloatingPicturePlacement } from '../pictures/placement'
import { readPictureShape } from '../pictures/shape'
import type { FloatingPictureIndex } from '../pictures/types'
import { readTextShape } from '../textboxes/shape'
import type { DocDrawingShape, DrawingSourceData } from '../types'
import { mapGroupFrame, sourceGroupFrame } from './geometry'
import type { DrawingGroupFrame, DrawingGroupIndex, SourceDrawingGroup, SourceDrawingGroupNode, SourceFloatingGroup } from './types'

/** @param shape - Actual source group. @param data - Shared immutable graph. @param context - Source work owner. @returns Validated group-local properties without interpreting children as independently anchored drawings. */
function groupProperties(shape: DocDrawingShape, data: DrawingSourceData, context: PictureReadContext): OfficeArtEffectiveProperties {
  requireDoc(Boolean(shape.flags & 1) && (shape.flags & ~0x203) === 0 && Boolean(shape.flags & 0x200),
    'unsupported-picture', 'Group reflection, OLE or unsupported role flags require another geometry path')
  const properties = compileOfficeArtProperties([...data.source.defaults, ...shape.propertyTables].flatMap(table => table.properties), context.reader)
  requireDoc(properties.scalar(4, 0) === 0, 'unsupported-picture', 'Rotated group coordinates require a full affine projection')
  requireDoc(properties.scalar(128, 0) === 0, 'unsupported-picture', 'A group-owned author text story requires an independent text owner')
  requireDoc(!properties.flag(959, 1, false) && !properties.flag(959, 7, false), 'unsupported-picture', 'Hidden or script-bearing groups require their own lifecycle')
  return properties
}

/** @param index - Unique original physical anchor. @param data - Complete original graph. @param context - Shared source work and media budgets. @param media - Cached original BStore loader. @param lookup - Once-built same-part hierarchy. @returns Complete ordinary group or an atomic refusal, with no author text claimed. */
export function readFloatingGroup(index: FloatingPictureIndex, data: DrawingSourceData, context: PictureReadContext,
  media: (index: number) => Pick<SourcePictureFrame, 'bytes' | 'mime'>, lookup: DrawingGroupIndex): SourceFloatingGroup {
  const shape = index.shape, parent = index.parent
  requireDoc(shape && parent && parent.parentId === null && Boolean(parent.flags & 1) && !shape.childBounds && index.anchorReferences === 1,
    'unsupported-picture', 'Group needs one unique physical FSPA under the structural drawing root')
  const properties = groupProperties(shape, data, context), placement = readFloatingPicturePlacement(index, properties)
  requireDoc(placement.wrap === 'none' && placement.allowOverlap && placement.horizontal.alignment === null && placement.vertical.alignment === null,
    'unsupported-picture', 'Only offset-positioned non-wrapping groups fit the existing native host contract')
  const record = data.shapeRecords.get(shape)
  requireDoc(record, 'invalid-drawing-data', 'Group has no original physical record')
  const records = readOfficeArtRecords(record.data, { ...context, errorCode: 'invalid-drawing-data' })
  requireDoc(!records.some(value => value.type === 0xf00d), 'unsupported-picture', 'Group ClientTextbox is outside independent child text ownership')
  requireDoc(records.filter(value => value.type === 0xf011).every(value => value.data.length === 4), 'invalid-drawing-data', 'Invalid group Word client data')
  const staleClientAnchor = readFloatingPictureAssociation(records, index.anchorIndex, index.anchorReferences)
  const width = (index.anchor.bounds[2] - index.anchor.bounds[0]) * 635, height = (index.anchor.bounds[3] - index.anchor.bounds[1]) * 635
  requireDoc(width > 0 && height > 0, 'unsupported-picture', 'Group creation rectangle must have positive extents')
  const seen = new Set<number>()

  /** @param current - Original group shape. @param frame - Physical extent relative to its real parent. @param depth - Bounded original group depth. @param supplied - Already-read outer placement properties. @returns Whole validated subtree, preserving physical child order. */
  function visit(current: DocDrawingShape, frame: DrawingGroupFrame, depth: number, supplied?: OfficeArtEffectiveProperties): SourceDrawingGroup {
    requireDoc(depth <= context.limits.maxDrawingDepth, 'limit-exceeded', 'Group projection depth exceeded')
    requireDoc(depth <= 17, 'unsupported-picture', 'Group depth exceeds the native simple-group host contract')
    requireDoc(lookup.shapes.get(current.id) === current && !seen.has(current.id), 'unsupported-picture', 'Group identities are cyclic or ambiguous')
    seen.add(current.id); context.reader.consume(1)
    const currentRecord = data.shapeRecords.get(current)
    requireDoc(currentRecord, 'invalid-drawing-data', 'Group has no original physical record')
    const currentRecords = current === shape ? records : readOfficeArtRecords(currentRecord.data, { ...context, errorCode: 'invalid-drawing-data' })
    requireDoc(!currentRecords.some(value => value.type === 0xf00d), 'unsupported-picture', 'Group-owned ClientTextbox requires an independent text owner')
    requireDoc(currentRecords.filter(value => value.type === 0xf011).every(value => value.data.length === 4), 'invalid-drawing-data', 'Invalid group Word client data')
    const local = supplied ?? groupProperties(current, data, context), source = sourceGroupFrame(current.groupBounds)
    const children: SourceDrawingGroupNode[] = [], shapes = lookup.children.get(current.id) ?? []
    requireDoc(shapes.length > 0, 'unsupported-picture', 'Group has no original children')
    for (const child of shapes) {
      context.reader.consume(1)
      requireDoc(lookup.shapes.get(child.id) === child && !seen.has(child.id) && Boolean(child.flags & 2) && !lookup.anchors.has(child.id),
        'unsupported-picture', 'Group child has ambiguous identity, ownership or an independent physical anchor')
      const target = mapGroupFrame(child.childBounds, source, frame)
      if (child.flags & 1) { children.push(visit(child, target, depth + 1)); continue }
      seen.add(child.id)
      const anisotropic = Math.abs(frame.width / source.width - frame.height / source.height) > 1e-9
      if (child.type === 75) {
        const value = readPictureShape(child, data, context, media, target.width / 635, target.height / 635)
        const picture = value.load()
        requireDoc(!anisotropic || picture.rotation === 0, 'unsupported-picture', 'Rotated picture under anisotropic group scale requires shear')
        children.push({ kind: 'picture', shapeId: child.id, frame: target, mediaIndex: value.mediaIndex, picture })
      } else {
        const value = readTextShape(child, data, context)
        requireDoc((value.shape.textId & 65535) === 0 && (value.shape.textId > 0 || !value.shape.textbox),
          'unsupported-picture', 'Group textbox needs an exact ordinary single-frame text identity')
        requireDoc(!anisotropic || value.shape.rotation === 0, 'unsupported-picture', 'Rotated text shape under anisotropic group scale requires shear')
        children.push({ kind: 'textbox', frame: target, box: { ...value.shape, position: index.anchor.position,
          kind: index.part.kind === 'main' ? 'textbox' : 'headerTextbox', extent: [target.width, target.height], placement, staleClientAnchor: false } })
      }
    }
    const lockAspect = local.flag(127, 7, false)
    return { kind: 'group', shapeId: current.id, frame, children, lockAspect, unprojected: local.unprojected(),
      unprojectedRecords: current.unprojectedRecords.filter(type => ![0xf010, 0xf011].includes(type)) }
  }
  return { kind: index.part.kind, position: index.anchor.position, placement,
    group: visit(shape, { x: 0, y: 0, width, height }, 1, properties), staleClientAnchor }
}
