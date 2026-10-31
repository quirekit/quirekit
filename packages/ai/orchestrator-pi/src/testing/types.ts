import type { QuireDocumentSdk } from "@quirekit/ai-runtime";
import type { Mock } from "vitest";

/** Public Document SDK protocol fixture with observable boundaries. */
export interface TestDocumentFixture {
  /** Complete engine-neutral API. */
  readonly document: QuireDocumentSdk;
  /** Public invocation spy. */
  readonly invoke: Mock<QuireDocumentSdk["invoke"]>;
  /** Request release spy. */
  readonly releaseRequest: Mock<QuireDocumentSdk["releaseRequest"]>;
  /** Detached progress spy. */
  readonly observeInput: Mock<QuireDocumentSdk["observeInput"]>;
  /** Request capture spy. */
  readonly captureRequest: Mock<QuireDocumentSdk["captureRequest"]>;
}
