import type { DocInspection } from '../types'

/** @param value - Untrusted source field. @param maximum - Original unsigned field ceiling. @returns Whether this is an exact bounded unsigned integer. */
function unsigned(value: unknown, maximum = 0xffffffff): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum
}

/**
 * Checks complete requested textbox metadata, including source spare roles and original ignored endpoints.
 * @param result - Untrusted structured-clone inspection reply.
 * @param maximum - Validated caller allocation budget shared by both source parts and record families.
 * @returns Whether every requested source field and relative-coordinate invariant is present.
 */
export function validWorkerTextboxes(result: DocInspection, maximum: number): boolean {
  const source = result.textboxes
  if (source?.scope !== 'textbox-source' || !Array.isArray(source.parts) || source.parts.length !== 2 || typeof result.text !== 'string') return false
  let count = 0
  for (let partIndex = 0; partIndex < 2; partIndex++) {
    const part = source.parts[partIndex], kind = partIndex === 0 ? 'textbox' : 'headerTextbox'
    const story = result.stories?.[partIndex === 0 ? 5 : 6]
    if (!part || part.kind !== kind || !story || story.kind !== kind || !unsigned(story.start) || !unsigned(story.end)
      || story.end < story.start || story.end > result.text.length || !Array.isArray(part.entries) || !Array.isArray(part.breaks)
      || !(part.textTerminalCp === null || unsigned(part.textTerminalCp)) || !(part.breakTerminalCp === null || unsigned(part.breakTerminalCp))) return false
    count += part.entries.length + part.breaks.length
    if (count > maximum) return false
    const length = story.end - story.start
    if (length && part.entries.length === 0) return false
    for (let index = 0; index < part.entries.length; index++) {
      const entry = part.entries[index], terminal = index === part.entries.length - 1
      if (!entry || entry.index !== index || !unsigned(entry.start) || !unsigned(entry.end) || !unsigned(entry.reuseFlags, 0xffff)
        || entry.reusable !== (terminal || entry.reuseFlags !== 0) || !Array.isArray(entry.data) || entry.data.length !== 2
        || !unsigned(entry.data[0]) || !unsigned(entry.data[1]) || !unsigned(entry.destination) || !unsigned(entry.shapeId) || !unsigned(entry.undoTextId)
        || index > 0 && entry.start !== part.entries[index - 1]?.end || terminal && part.textTerminalCp !== entry.end) return false
      if (length) {
        if (index === 0 && entry.start !== 0 || terminal && entry.start !== length - 1) return false
        if (!terminal && (!(entry.end > entry.start && entry.end < length)
          || (entry.reusable ? entry.end - entry.start !== 1 : entry.end - entry.start <= 1)
          || result.text.charCodeAt(story.start + entry.end - 1) !== 13)) return false
      } else if (!entry.reusable) return false
    }
    for (let index = 0; index < part.breaks.length; index++) {
      const fragment = part.breaks[index]
      if (!fragment || fragment.index !== index || !unsigned(fragment.start) || !unsigned(fragment.end)
        || !unsigned(fragment.textboxIndex, 0xffff) || !Number.isSafeInteger(fragment.dependency)
        || fragment.dependency < -32768 || fragment.dependency > 32767 || !unsigned(fragment.flags, 0xffff)
        || index > 0 && fragment.start !== part.breaks[index - 1]?.end
        || index === part.breaks.length - 1 && part.breakTerminalCp !== fragment.end) return false
    }
  }
  return true
}
