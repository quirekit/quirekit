import type { CompactionSettings } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";

/**
 * Scales native compaction headroom to the current model's context window.
 * @param model - Currently selected provider model.
 * @returns Native Pi settings that fit both small and large context windows.
 */
export function modelCompactionSettings(model: Model<Api>): CompactionSettings {
  return {
    enabled: true,
    reserveTokens: Math.min(16_384, Math.floor(model.contextWindow / 4)),
    keepRecentTokens: Math.min(20_000, Math.floor(model.contextWindow / 3))
  };
}
