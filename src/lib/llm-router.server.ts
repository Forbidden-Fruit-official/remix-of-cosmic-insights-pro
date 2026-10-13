// Narrative LLM routing. Order: OpenAI (OPENAI_API_KEY) is primary; Lovable AI
// Gateway is the fallback if OpenAI is missing, errors, times out or returns
// empty output. Prose only — never astronomical calculations. Prompts and keys
// are never logged.
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const OPENAI_TIMEOUT_MS = 120_000;
const FALLBACK_MODEL = "google/gemini-3-flash-preview";

export interface NarrativeRequest {
  system: string;
  prompt: string;
}

export type ProviderName = "openai" | "lovable-gateway";

export interface NarrativeResult {
  text: string;
  provider: ProviderName;
  attempts: { provider: ProviderName; ok: boolean; error?: string }[];
}

export function providerConfig() {
  return {
    order: ["openai", "lovable-gateway"] as ProviderName[],
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
    gatewayConfigured: !!process.env.LOVABLE_API_KEY,
  };
}

/** Coarse, secret-free error category for logs/diagnostics. */
export function errorCategory(err: unknown): string {
  const e = err as { statusCode?: number; name?: string; message?: string };
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return "timeout";
  if (e?.statusCode === 401) return "auth_invalid_key";
  if (e?.statusCode === 403) return "forbidden";
  if (e?.statusCode === 404) return "model_not_found";
  if (e?.statusCode === 429) return "rate_limited_or_quota";
  if (e?.statusCode && e.statusCode >= 500) return "provider_server_error";
  if (e?.message === "empty_output") return "empty_output";
  return "network_or_unknown";
}

type Attempt = (req: NarrativeRequest) => Promise<string>;

export async function runWithFallback(
  req: NarrativeRequest,
  providers: { name: ProviderName; run: Attempt }[],
): Promise<NarrativeResult> {
  const attempts: NarrativeResult["attempts"] = [];
  for (const p of providers) {
    try {
      const text = await p.run(req);
      if (!text.trim()) throw new Error("empty_output");
      attempts.push({ provider: p.name, ok: true });
      return { text, provider: p.name, attempts };
    } catch (err) {
      const cat = errorCategory(err);
      attempts.push({ provider: p.name, ok: false, error: cat });
      console.warn(`[llm] ${p.name} failed (${cat}); trying next provider`);
    }
  }
  throw new Error(
    `All LLM providers failed: ${attempts.map((a) => `${a.provider}=${a.error}`).join(", ") || "none configured"}`,
  );
}

export async function generateNarrative(req: NarrativeRequest): Promise<NarrativeResult> {
  const providers: { name: ProviderName; run: Attempt }[] = [];
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAICompatible({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      headers: { Authorization: `Bearer ${openaiKey}` },
    });
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    providers.push({
      name: "openai",
      run: async (r) =>
        (
          await generateText({
            model: openai(model),
            system: r.system,
            prompt: r.prompt,
            maxRetries: 1, // one SDK retry for 429/5xx, then fall back
            abortSignal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
          })
        ).text,
    });
  }
  const key = process.env.LOVABLE_API_KEY;
  if (key) {
    const gateway = createLovableAiGatewayProvider(key);
    providers.push({
      name: "lovable-gateway",
      run: async (r) =>
        (await generateText({ model: gateway(FALLBACK_MODEL), system: r.system, prompt: r.prompt })).text,
    });
  }
  return runWithFallback(req, providers);
}
