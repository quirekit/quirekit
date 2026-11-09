import { requireDoc } from '../../../errors'
import type { OfficeArtEffectiveProperties } from '../../office-art/types'
import type { FloatingPictureAxis, FloatingPictureIndex, FloatingPicturePlacement } from './types'

/** @param properties - Effective source fields with independent use-bit tracking. @param horizontal - Axis selector. @param flags - Raw FSPA flags. @param offset - Original left/top twips. @returns Complete supported source axis. */
function axis(properties: OfficeArtEffectiveProperties, horizontal: boolean, flags: number, offset: number): FloatingPictureAxis {
  const sourceReference = horizontal ? flags >>> 1 & 3 : flags >>> 3 & 3
  const referenceId = horizontal ? 912 : 914
  const explicit = properties.property(referenceId) ? properties.scalar(referenceId, -1) : undefined
  const references = horizontal ? ['margin', 'page', 'column', 'character'] : ['margin', 'page', 'paragraph', 'line']
  const reference = explicit === undefined ? sourceReference : explicit - 1
  requireDoc(reference >= 0 && reference < references.length && (explicit !== undefined || sourceReference < 3),
    'unsupported-picture', 'Unsupported floating picture position reference')
  const align = properties.scalar(horizontal ? 911 : 913, 0)
  const alignments = horizontal ? ['', 'left', 'center', 'right', 'inside', 'outside'] : ['', 'top', 'center', 'bottom', 'inside', 'outside']
  requireDoc(align >= 0 && align < alignments.length, 'unsupported-picture', 'Unsupported floating picture alignment')
  return { reference: references[reference]!, alignment: align === 0 ? null : alignments[align]!, offset: offset * 635 }
}

/**
 * Interprets the ordinary source anchor as a complete atomic position/wrap tuple.
 * @param index - Original anchor, physical rank and unique part ownership.
 * @param properties - Global/default/local source value authority.
 * @returns Complete basic placement without applying a new-picture preset.
 */
export function readFloatingPicturePlacement(index: FloatingPictureIndex, properties: OfficeArtEffectiveProperties): FloatingPicturePlacement {
  const { anchor } = index, flags = anchor.flags, wrap = flags >>> 5 & 15, side = flags >>> 9 & 15
  requireDoc(wrap <= 5 && !(flags & 0x2000) && ([1, 3].includes(wrap) || side <= 3),
    'unsupported-picture', 'Unsupported floating picture wrapping or rectangle flags')
  const sourceBehind = wrap === 3 && Boolean(flags & 0x4000)
  const behind = properties.flag(959, 5, sourceBehind)
  requireDoc(wrap !== 3 || behind === sourceBehind, 'unsupported-picture', 'Conflicting floating picture paint-side authorities')
  requireDoc(!properties.flag(959, 1, false) && !properties.flag(959, 7, false),
    'unsupported-picture', 'Hidden shapes and script anchors require their own source lifecycle')
  const distances = [properties.scalar(900, 114300), properties.scalar(901, 0),
    properties.scalar(902, 114300), properties.scalar(903, 0)] as const
  requireDoc(distances.every(value => value >= 0), 'unsupported-picture', 'Negative picture wrap distances are outside the admitted host contract')
  return { horizontal: axis(properties, true, flags, anchor.bounds[0]), vertical: axis(properties, false, flags, anchor.bounds[1]),
    wrap: wrap === 1 ? 'top-and-bottom' : wrap === 3 ? 'none' : wrap === 4 ? 'tight' : wrap === 5 ? 'through' : 'square',
    side: ['bothSides', 'left', 'right', 'largest'][side] ?? 'bothSides', distances, behind, locked: Boolean(flags & 0x8000),
    layoutInCell: properties.flag(959, 15, true), allowOverlap: properties.flag(959, 9, true), rank: index.rank }
}
