import { v4 } from "uuid";
import type {
  CreateWordNumberingInstanceResult,
  WordNumberingRegistry
} from "../types";
import { createDefaultWordNumberingRegistry } from "./defaults";
import { isWordNumberingRegistry } from "./validation";

/**
 * Resolves persisted registry data or supplies clean built-in definitions.
 *
 * @param value - Candidate document `wordNumberingRegistry` attr.
 * @returns Valid registry safe for commands and View projection.
 */
export function resolveWordNumberingRegistry(value: unknown): WordNumberingRegistry {
  return isWordNumberingRegistry(value)
    ? value
    : createDefaultWordNumberingRegistry();
}

/**
 * Adds one concrete list instance while preserving existing definitions. The
 * id is a uuid so lists created concurrently by collaborators never share one.
 *
 * @param registry - Current document numbering registry.
 * @param abstractNumId - Existing abstract definition to instantiate.
 * @returns Updated registry and allocated concrete id.
 */
export function createWordNumberingInstance(
  registry: WordNumberingRegistry,
  abstractNumId: string
): CreateWordNumberingInstanceResult {
  if (registry.abstractNums[abstractNumId] === undefined) {
    throw new Error(`Missing Word abstract numbering definition: ${abstractNumId}`);
  }
  let numId = `quirekit-num-${v4()}`;
  while (registry.nums[numId] !== undefined) numId = `quirekit-num-${v4()}`;
  return {
    numId,
    registry: {
      ...registry,
      nums: {
        ...registry.nums,
        [numId]: { id: numId, abstractNumId }
      }
    }
  };
}
