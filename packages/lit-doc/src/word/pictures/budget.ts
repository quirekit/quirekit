import { requireDoc } from '../../errors'
import type { PictureReadContext } from './types'

/** @param context - Shared per-document media budget. @param count - Decoded media byte count. */
export function chargePictureBytes(context: PictureReadContext, count: number): void {
  requireDoc(Number.isSafeInteger(count) && count > 0, 'invalid-picture-data', 'Picture payload is empty or has an invalid length')
  requireDoc(count <= context.limits.maxPictureBytes && count <= context.limits.maxTotalPictureBytes - context.decodedBytes,
    'limit-exceeded', 'Decoded picture byte limit exceeded')
  context.decodedBytes += count
}
