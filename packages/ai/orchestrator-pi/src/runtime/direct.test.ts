import { describe, expect, it } from "vitest";
import { createQuireAiPiDirectRuntime } from "./direct";

describe("direct runtime", () => {
  it("sends the system prompt with the system role through any OpenAI-compatible gateway", async () => {
    const bodies: unknown[] = [];
    const fetch: typeof globalThis.fetch = async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    };
    // A same-origin gateway hides the upstream provider from URL-based detection; reasoning models would otherwise use `developer`.
    const runtime = createQuireAiPiDirectRuntime({
      id: "gateway", providerName: "Gateway", api: "openai-completions", baseUrl: "http://localhost:3300/api/ai/profile",
      modelId: "deepseek-flash", contextWindow: 64_000, maxTokens: 1_000, reasoning: true, auth: { apiKey: "key" }, maxRetries: 0, fetch
    });
    const stream = runtime.streamFn(runtime.model, { systemPrompt: "简短回答", messages: [{ role: "user", content: "你好", timestamp: 0 }] });
    for await (const _event of stream) { /* drain */ }
    expect(bodies).toHaveLength(1);
    expect((bodies[0] as { messages: { role: string }[] }).messages[0]!.role).toBe("system");
  });
});
