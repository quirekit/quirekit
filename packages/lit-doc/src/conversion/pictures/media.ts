import { requireDoc } from '../../errors'
import type { SourcePictureFrame } from '../../word/pictures/types'
import type { ProjectionContext } from '../xml/types'
import { pictureGeometry } from './drawing'
import type { PictureMediaDraft, PictureProjectionOwner } from './types'

/** @param owner - Shared document media-work counters. @param picture - Complete original occurrence. @param resourceKey - Stable original media identity. @param sourcePart - Actual OPC relationship owner. @param context - Located loss and XML owner. @returns Private validated media plans; nothing is installed in the package yet. */
export function preparePictureMedia(owner: PictureProjectionOwner, picture: SourcePictureFrame, resourceKey: string,
  sourcePart: string, context: ProjectionContext): PictureMediaDraft {
  owner.referencedBytes += picture.bytes.length
  requireDoc(owner.referencedBytes <= owner.reader.limits.maxTotalPictureBytes, 'limit-exceeded', 'Picture occurrence byte limit exceeded')
  const geometry = pictureGeometry(picture, context)
  const key = sourcePart === '/word/document.xml' ? resourceKey : `${sourcePart}:${resourceKey}`
  if (picture.unprojected.length) context.diagnose({ code: 'picture-properties-unprojected', kind: 'loss', source: 'picture',
    message: `Source picture properties ${picture.unprojected.join(', ')} require additional interpretation.` })
  if (picture.unprojectedRecords.length) context.diagnose({ code: 'picture-records-unprojected', kind: 'loss', source: 'picture',
    message: `Source picture records ${picture.unprojectedRecords.map(value => `0x${value.toString(16)}`).join(', ')} require additional interpretation.` })
  if (picture.hasBorders) context.diagnose({ code: 'picture-borders-unprojected', kind: 'loss', source: 'picture', message: 'Source PICF picture borders require additional projection.' })
  if (!['image/png', 'image/jpeg'].includes(picture.mime)) context.diagnose({ code: 'picture-media-host-limit', kind: 'host-limit', source: 'picture',
    message: `${picture.mime} bytes are retained in the package; browser rendering requires a compatible media decoder.` })
  return { geometry, resource: { key: resourceKey, kind: 'image', mediaType: picture.mime, data: picture.bytes },
    relationship: { key, sourcePart, relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', target: resourceKey, targetMode: 'internal' } }
}
