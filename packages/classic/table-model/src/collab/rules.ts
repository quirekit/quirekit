import type { CollabRule } from "@quirekit/collab-contract";
import { repairWordTable } from "../commands/repair/repair";
import { createWordTableMap } from "../map/build";

/**
 * Collaboration rules of Word tables: every grid stays rectangular after a
 * change; a broken grid is first repaired safely (filling missing cells),
 * then by widening it to the occupied width, and rejected only when neither
 * helps.
 *
 * @returns Rules for `addCollabRules()`.
 */
export function createWordTableCollabRules(): readonly CollabRule[] {
  return [
    { kind: "version", version: "2" },
    { kind: "root", attribute: "wordTableStyleRegistry", strategy: "merge" },
    // Record kinds of table structure changes (11.2).
    { kind: "record", classify: (facts) => facts.added.includes("wordTable") ? { kind: "table.insert", kindVersion: 1 }
      : facts.removed.includes("wordTable") ? { kind: "table.remove", kindVersion: 1 }
      : facts.added.includes("wordTableRow") ? { kind: "table.insert-row", kindVersion: 1 }
      : facts.removed.includes("wordTableRow") ? { kind: "table.delete-row", kindVersion: 1 }
      : facts.added.includes("wordTableCell") ? { kind: "table.insert-column", kindVersion: 1 }
      : facts.removed.includes("wordTableCell") ? { kind: "table.delete-column", kindVersion: 1 } : null },
    {
      kind: "node", node: "wordTable", reasons: ["table-grid"],
      scope: { nodes: ["wordTable", "wordTableRow", "wordTableCell"], within: ["wordTableCell"] },
      validate: (table) => createWordTableMap(table).diagnostics.length > 0 ? "table-grid" : null,
      repair: (table) => {
        const safe = repairWordTable(table);
        if (safe.ok) return safe.value.tableNode;
        const explicit = repairWordTable(table, { mode: "explicit", overflow: "expand-grid", malformedContinuation: "restart" });
        return explicit.ok ? explicit.value.tableNode : null;
      }
    }
  ];
}
