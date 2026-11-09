import { requireDoc } from '../../../errors'
import type { DrawingGroupFrame } from './types'

/** @param bounds - Original integer rectangle. @returns Positive original coordinate frame without reversing unknown axes. */
export function sourceGroupFrame(bounds: readonly number[] | null): DrawingGroupFrame {
  requireDoc(bounds?.length === 4, 'unsupported-picture', 'Group has no complete original coordinate rectangle')
  const frame = { x: bounds[0]!, y: bounds[1]!, width: bounds[2]! - bounds[0]!, height: bounds[3]! - bounds[1]! }
  requireDoc(Object.values(frame).every(Number.isFinite) && frame.width > 0 && frame.height > 0,
    'unsupported-picture', 'Group coordinate axes must have positive extents')
  return frame
}

/** @param bounds - Original child rectangle. @param source - Actual parent coordinate authority. @param target - Physical parent extent in EMU. @returns Derived physical child frame, with no intermediate integer rounding. */
export function mapGroupFrame(bounds: readonly number[] | null, source: DrawingGroupFrame, target: DrawingGroupFrame): DrawingGroupFrame {
  const child = sourceGroupFrame(bounds), scaleX = target.width / source.width, scaleY = target.height / source.height
  const frame = { x: (child.x - source.x) * scaleX, y: (child.y - source.y) * scaleY, width: child.width * scaleX, height: child.height * scaleY }
  requireDoc(Object.values(frame).every(value => Number.isFinite(value) && Number.isSafeInteger(Math.round(value)) && Math.abs(value) <= 0x7fffffff * 635)
    && Math.round(frame.width) >= 1 && Math.round(frame.height) >= 1, 'unsupported-picture', 'Group child physical coordinates exceed the admitted source range')
  return frame
}
