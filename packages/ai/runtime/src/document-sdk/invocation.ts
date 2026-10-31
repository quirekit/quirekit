import { QuireDocumentSdkError } from "./error";
import { copyDocumentJson } from "./json";
import type { QuireDocumentInvocation } from "./types";

/**
 * Validates the transport envelope before allocating an operation.
 * @param value - Caller payload, including untyped JSON transport input.
 * @returns Detached invocation with valid routing identities.
 */
export function copyDocumentInvocation(value: QuireDocumentInvocation): QuireDocumentInvocation {
  const input = copyDocumentJson(value);
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new QuireDocumentSdkError("invalid-input", "A document invocation must be a JSON object.");
  }
  if (typeof input.operationId !== "string" || !input.operationId.trim()) {
    throw new QuireDocumentSdkError("invalid-operation", "An operation identity is required.");
  }
  if (typeof input.toolName !== "string" || !input.toolName.trim()) {
    throw new QuireDocumentSdkError("invalid-input", "A document tool name is required.");
  }
  if (input.requestId !== undefined && (typeof input.requestId !== "string" || !input.requestId.trim())) {
    throw new QuireDocumentSdkError("invalid-input", "A request identity must be a non-empty string.");
  }
  if (!Object.hasOwn(input, "input")) throw new QuireDocumentSdkError("invalid-input", "Document tool arguments are required.");
  return input;
}
