import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { OfficeArtRecord } from '../../office-art/types'

/**
 * Keeps FSPA ownership authoritative for the observed stale-zero variant without accepting arbitrary pointer conflicts.
 * @param records - Bounded original shape children.
 * @param expectedIndex - Actual same-part FSPA slot selected by the displayed source CP.
 * @param anchorReferences - Number of same-part FSPAs naming this unique shape.
 * @returns Whether a well-formed stale zero was recovered through a unique FSPA association.
 */
export function readFloatingPictureAssociation(records: readonly OfficeArtRecord[], expectedIndex: number, anchorReferences: number): boolean {
  const clients = records.filter(record => record.type === 0xf010)
  requireDoc(clients.length <= 1, 'invalid-drawing-data', 'Floating shape has ambiguous client anchors')
  if (!clients[0]) return false
  requireDoc(clients[0].data.length === 4, 'invalid-drawing-data', 'Floating ClientAnchor has an invalid original extent')
  const declaredIndex = new ByteView(clients[0].data, 'invalid-drawing-data').u32(0)
  if (declaredIndex === expectedIndex) return false
  // Some producers leave zero on later shapes. The unique same-part CP/FSPA
  // association supplies position; a repeated shape reference cannot use it.
  requireDoc(declaredIndex === 0 && expectedIndex > 0 && anchorReferences === 1,
    'invalid-drawing-data', 'Floating ClientAnchor disagrees with its original shape position')
  return true
}
