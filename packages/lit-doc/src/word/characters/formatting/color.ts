import type { DocCharacterColor } from '../types'
import { palette, colorRefValue } from '../../formatting/color'
export { palette, colorRefValue } from '../../formatting/color'

/** @param color - Validated palette or COLORREF source value. @returns Semantic automatic or RGB identity, without materializing automatic as black. */
export function colorValue(color: DocCharacterColor): string {
  return color.encoding === 'palette' ? palette[color.value]! : colorRefValue(color.value)
}
