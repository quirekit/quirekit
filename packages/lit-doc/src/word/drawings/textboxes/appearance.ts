import { requireDoc } from '../../../errors'
import type { OfficeArtEffectiveProperties } from '../../office-art/types'
import type { TextboxPaint } from './types'

/** @param properties - Ordered effective source properties. @param fill - Select fill rather than outline. @returns Ordinary solid/no-fill paint without guessing a palette or theme. */
export function readTextboxPaint(properties: OfficeArtEffectiveProperties, fill: boolean): TextboxPaint {
  const visible = properties.flag(fill ? 447 : 511, fill ? 4 : 3, true)
  if (!visible) return { color: null, opacity: 1 }
  requireDoc(properties.scalar(fill ? 384 : 452, 0) === 0, 'unsupported-picture', 'Complex textbox fill or line needs its own appearance projection')
  requireDoc(fill || properties.scalar(461, 0) === 0 && properties.scalar(462, 0) === 0,
    'unsupported-picture', 'Compound or dashed textbox outlines need their own projection')
  const color = properties.scalar(fill ? 385 : 448, fill ? 0xffffff : 0) >>> 0
  requireDoc(color <= 0xffffff, 'unsupported-picture', 'Textbox palette or system color is outside direct RGB projection')
  const opacity = properties.scalar(fill ? 386 : 449, 65536)
  requireDoc(opacity >= 0 && opacity <= 65536, 'invalid-drawing-data', 'Textbox paint opacity is outside its source range')
  return { color: [color & 255, color >>> 8 & 255, color >>> 16 & 255].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase(),
    opacity: opacity / 65536 }
}
