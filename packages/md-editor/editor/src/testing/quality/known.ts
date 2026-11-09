/** Failing cells grouped by cause; each group leaves this list once its fix lands. */
const gaps: Readonly<Record<string, readonly string[]>> = {
};

/** Cells that fail an invariant for a documented reason, by cell id. */
export const knownQualityGaps: ReadonlySet<string> = new Set(Object.values(gaps).flat());
