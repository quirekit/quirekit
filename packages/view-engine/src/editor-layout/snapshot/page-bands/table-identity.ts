import type { QuireTableLayoutSnapshot } from "../../../layout/engine/table";

/**
 * Gives table geometry the same occurrence suffix as its recursive content boxes.
 * Cell clips resolve content by geometry id, while editing continues to use the
 * retained logical table and semantic cell identities and document ranges.
 * @param table - Translated source table geometry, still privately source-owned.
 * @param occurrenceId - Enclosing repeated-story occurrence suffix.
 * @returns Immutable occurrence geometry with connected cell clips and unique paint ids.
 */
export function identifyQuireStoryTableOccurrence(
  table: QuireTableLayoutSnapshot,
  occurrenceId: string
): QuireTableLayoutSnapshot {
  return {
    ...table,
    geometryId: `${table.geometryId}:${occurrenceId}`,
    fragmentId: `${table.fragmentId}:${occurrenceId}`,
    tracks: table.tracks.map(track => ({ ...track, id: `${track.id}:${occurrenceId}` })),
    rows: table.rows.map(row => ({ ...row, id: `${row.id}:${occurrenceId}` })),
    cells: table.cells.map(cell => ({ ...cell, id: `${cell.id}:${occurrenceId}` })),
    hitTargets: table.hitTargets.map(target => ({ ...target, id: `${target.id}:${occurrenceId}` }))
  };
}
