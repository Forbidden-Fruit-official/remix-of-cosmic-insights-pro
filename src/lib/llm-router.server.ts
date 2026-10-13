// Narrative LLM routing: OpenAI (direct, via OPENAI_API_KEY) is primary when
// configured; Lovable AI Gateway is the fallback if OpenAI is missing, errors,
// or times out. Only used for prose — never for astronomical calculations.
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const OPENAI_TIMEOUT_MS = 120_000;
const FALLBACK_MODEL = "google/gemini-3-flash-preview";

export interface NarrativeRequest {
  system: string;
  prompt: string;
}

export interface NarrativeResult {
  text: string;
  provider: "openai" | "lovable-gateway";
}

export async function generateNarrative(req: NarrativeRequest): Promise<NarrativeResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const openai = createOpenAICompatible({
        name: "openai",
        baseURL: "https://api.openai.com/v1",
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      const model = process.env.OPENAI_MODEL || "gpt-5-mini";
      const { text } = await generateText({
        model: openai(model),
        system: req.system,
        prompt: req.prompt,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
      });
      if (text.trim()) return { text, provider: "openai" };
      console.warn("[llm] OpenAI returned empty text; falling back");
    } catch (err) {
      console.warn("[llm] OpenAI failed; falling back:", (err as Error)?.message);
    }
  }

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("No LLM provider configured");
  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(FALLBACK_MODEL),
    system: req.system,
    prompt: req.prompt,
  });
  return { text, provider: "lovable-gateway" };
}
