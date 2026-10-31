import type { QuireDocumentSdk } from "@quirekit/ai-runtime";
import { describe, expect, it } from "vitest";
import { documentOperationId } from "../tools";
import { createPiRunBudget } from "./budget";

/**
 * @param committed - Tool call ids whose write operation committed a change.
 * @returns Minimal SDK with one read and one write tool.
 */
function createDocument(committed: ReadonlySet<string>): QuireDocumentSdk {
  return {
    tools: () => [{ name: "document_read", effect: "read" }, { name: "document_edit", effect: "write" }],
    getOperation: (operationId: string) => ({ committed: [...committed].some(id => documentOperationId("s", "r", id) === operationId) })
  } as unknown as QuireDocumentSdk;
}

/**
 * Runs one model turn with the given tool calls.
 * @param budget - Budget under test.
 * @param calls - Tool name, arguments and failure of each call.
 * @returns Stop reason of the request that opened the turn.
 */
function turn(budget: ReturnType<typeof createPiRunBudget>, calls: readonly [string, string, unknown, boolean?][]): string | undefined {
  const stop = budget.admit();
  for (const [id, name, args, failed] of calls) {
    budget.start(id, name, args);
    budget.end(id, failed === true);
  }
  return stop;
}

describe("Pi run budget", () => {
  it("lets committed writes run past the idle bound until the hard bound", () => {
    const committed = new Set(["w1", "w2", "w3", "w4", "w5"]);
    const budget = createPiRunBudget(createDocument(committed), "s", "r", "q", { maxModelTurns: 6, maxIdleTurns: 2 });
    for (const id of committed) expect(turn(budget, [[id, "document_edit", { id }]])).toBeUndefined();
    expect(budget.admit()).toBeUndefined();
    expect(budget.admit()).toBe("turn-budget-exceeded");
  });

  it("stops after consecutive writes that commit nothing", () => {
    const budget = createPiRunBudget(createDocument(new Set()), "s", "r", "q", { maxModelTurns: 24, maxIdleTurns: 3 });
    expect(turn(budget, [["w1", "document_edit", { a: 1 }]])).toBeUndefined();
    expect(turn(budget, [["w2", "document_edit", { a: 2 }]])).toBeUndefined();
    expect(turn(budget, [["w3", "document_edit", { a: 3 }]])).toBeUndefined();
    expect(budget.admit()).toBe("no-progress");
  });

  it("counts a repeated read only after a committed write changed the document", () => {
    const budget = createPiRunBudget(createDocument(new Set(["w1"])), "s", "r", "q", { maxModelTurns: 24, maxIdleTurns: 2 });
    expect(turn(budget, [["r1", "document_read", {}]])).toBeUndefined();
    expect(turn(budget, [["r2", "document_read", {}]])).toBeUndefined();
    expect(turn(budget, [["w1", "document_edit", {}]])).toBeUndefined();
    expect(turn(budget, [["r3", "document_read", {}]])).toBeUndefined();
    expect(turn(budget, [["r4", "document_read", {}]])).toBeUndefined();
    expect(turn(budget, [["r5", "document_read", {}]])).toBeUndefined();
    expect(budget.admit()).toBe("no-progress");
  });

  it("never counts a failed call as progress", () => {
    const budget = createPiRunBudget(createDocument(new Set(["w1"])), "s", "r", "q", { maxModelTurns: 24, maxIdleTurns: 1 });
    expect(turn(budget, [["w1", "document_edit", {}, true]])).toBeUndefined();
    expect(budget.admit()).toBe("no-progress");
  });

  it("keeps the hard bound alone when no idle bound is set", () => {
    const budget = createPiRunBudget(createDocument(new Set()), "s", "r", "q", { maxModelTurns: 2 });
    expect(turn(budget, [["w1", "document_edit", {}]])).toBeUndefined();
    expect(turn(budget, [["w2", "document_edit", {}]])).toBeUndefined();
    expect(budget.admit()).toBe("turn-budget-exceeded");
  });
});
