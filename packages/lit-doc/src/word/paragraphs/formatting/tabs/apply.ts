import { requireDoc } from '../../../../errors'
import type { PropertyOperation, PropertyReader } from '../../../properties/types'
import { readTabOperation } from './read'
import type { DocParagraphTabs, DocTabStop } from './types'

/**
 * Applies one complete tab edit while preserving its current-layer delta.
 * @param tabs - Prior effective state, never modified in place.
 * @param operation - Original source operation.
 * @param reader - Common parse and repeated-work budget.
 * @returns Fresh effective stops and the final local writes at affected positions.
 */
export function applyTabOperation(tabs: DocParagraphTabs, operation: PropertyOperation, reader: PropertyReader): DocParagraphTabs {
  reader.consume(operation.operand.length)
  const edits = readTabOperation(operation)
  reader.consume(tabs.stops.length + tabs.changes.length)
  const stops = new Map(tabs.stops.map(stop => [stop.position, stop]))
  const changes = new Map<number, DocTabStop | null>(tabs.changes.map(change => [change.position, change.value]))

  // Resolve deletion ranges against the current inherited/local state before
  // additions. Exact clear positions retain today's result in OOXML.
  for (const removal of edits.removals) {
    reader.consume(stops.size + 1)
    changes.set(removal.position, null)
    for (const position of stops.keys()) if (position >= removal.start && position <= removal.end) {
      stops.delete(position)
      changes.set(position, null)
    }
  }
  reader.consume(edits.additions.length)
  for (const stop of edits.additions) {
    stops.set(stop.position, stop)
    changes.set(stop.position, stop)
  }
  requireDoc(stops.size <= 64, 'invalid-formatting-data', 'Effective custom tab count exceeds 64')
  return { stops: [...stops.values()].sort((left, right) => left.position - right.position),
    changes: [...changes].sort(([left], [right]) => left - right).map(([position, value]) => ({ position, value })),
    rangeDeletion: tabs.rangeDeletion || edits.removals.length > 0 }
}
