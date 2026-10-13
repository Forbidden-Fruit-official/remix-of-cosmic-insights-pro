// Admin-only diagnostics. Never returns secret values — only booleans,
// provider names and error categories.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(userId: string) {
  const { isAdminUser } = await import("@/lib/reports/access.server");
  if (!(await isAdminUser(userId))) throw new Error("Forbidden");
}

export const llmHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { generateNarrative, providerConfig } = await import("@/lib/llm-router.server");
    const config = providerConfig();
    try {
      const r = await generateNarrative({ system: "Reply with one word.", prompt: "Say OK." });
      return { config, ok: true, provider: r.provider, attempts: r.attempts };
    } catch (e) {
      return { config, ok: false, provider: null, error: (e as Error).message.slice(0, 200) };
    }
  });

export const createSpookyPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { getStripe } = await import("@/lib/reports/stripe.server");
    const { ensureSpookyPromo } = await import("@/lib/reports/promo.server");
    return ensureSpookyPromo(getStripe());
  });
