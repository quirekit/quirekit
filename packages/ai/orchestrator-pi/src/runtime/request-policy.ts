import type { ProviderStreams } from "@earendil-works/pi-ai";
import type { QuireAiPiRequestPolicy } from "./types";

/**
 * Binds application transport policy below Models so compaction uses it too.
 * @param api - Official Pi API implementation.
 * @param policy - Application-owned fetch and request bounds.
 * @returns Native Pi streams with no parsing or scheduling changes.
 */
export function bindPiRequestPolicy(api: ProviderStreams, policy: QuireAiPiRequestPolicy): ProviderStreams {
  const transport = {
    ...(policy.fetch === undefined ? {} : { fetch: policy.fetch }),
    ...(policy.timeoutMs === undefined ? {} : { timeoutMs: policy.timeoutMs }),
    ...(policy.maxRetries === undefined ? {} : { maxRetries: policy.maxRetries })
  };
  /**
   * Applies the configured model output ceiling before native provider mapping.
   * @param requested - Optional caller budget.
   * @returns Bounded request budget.
   */
  function maxTokens(requested: number | undefined): { maxTokens?: number } {
    const value = policy.maxTokens === undefined ? requested : Math.min(requested ?? policy.maxTokens, policy.maxTokens);
    return value === undefined ? {} : { maxTokens: value };
  }
  return {
    stream: (model, context, options) => api.stream(model, context, { ...options, ...transport, ...maxTokens(options?.maxTokens) }),
    streamSimple: (model, context, options) => api.streamSimple(model, context, { ...options, ...transport, ...maxTokens(options?.maxTokens) }),
    ...(api.fetchDeferred === undefined ? {} : {
      fetchDeferred: (model, handle, options) => api.fetchDeferred!(model, handle, { ...options, ...transport })
    }),
    ...(api.cancelDeferred === undefined ? {} : {
      cancelDeferred: (model, handle, options) => api.cancelDeferred!(model, handle, { ...options, ...transport })
    })
  };
}
