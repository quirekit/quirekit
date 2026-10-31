import type { AgentHarness, AgentLane, Session } from "@earendil-works/pi-agent-core";
import type { QuireAiPiModelRuntime } from "../types";

/** Initialized native Pi authorities for one complete conversation. */
export interface PiSessionState {
  /** Native durable storage and transcript authority. */
  readonly session: Session;
  /** Pi's sole operation driver. */
  readonly harness: AgentHarness<undefined>;
  /** The conversation's single foreground lane. */
  readonly lane: AgentLane;
}

/** Lazy session lifecycle owned by one application coordinator. */
export interface PiSessionController {
  /** @returns Initialized native authorities. */
  get(): Promise<PiSessionState>;
  /**
   * Updates the native provider registry and model without replacing history.
   * @param runtime - Optional next model runtime.
   * @param systemPrompt - Optional current instruction.
   * @returns Initialized session authorities.
   */
  configure(runtime?: QuireAiPiModelRuntime, systemPrompt?: string): Promise<PiSessionState>;
  /** @returns Settlement after closing the old conversation handle. */
  reset(): Promise<void>;
  /** @returns Settlement after closing all owned session resources. */
  close(): Promise<void>;
}
