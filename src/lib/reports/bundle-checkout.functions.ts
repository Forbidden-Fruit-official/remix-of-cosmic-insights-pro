import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { checkoutIdempotencyKey, checkoutOrigin } from "./checkout-policy";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Stripe Checkout for a gift bundle. The amount is always computed server-side. */
export const createBundleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bundleId: z.string().min(1).max(64), requestId: z.uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if ((context.claims as { is_anonymous?: boolean })?.is_anonymous) {
      throw new Error("Please sign in with Google before purchasing.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getStripe, ensureStripePrice } = await import("./stripe.server");
    const { getBundle, bundlePricing } = await import("./bundles");

    const bundle = getBundle(data.bundleId);
    if (!bundle) throw new Error("Unknown bundle.");
    const pricing = bundlePricing(bundle);
    if (pricing.count === 0) throw new Error("This bundle is empty.");

    const { resolveReportAccess } = await import("./access.server");
    const access = [];
    for (const reportId of bundle.reportIds) access.push(await resolveReportAccess(context.userId, reportId));
    if (access.every((item) => item.allowed)) return { alreadyOwned: true, url: null };
    if (access.some((item) => item.reason === "unpublished" || item.reason === "unknown_report")) {
      throw new Error("This set is not available for purchase.");
    }
    const { data: product, error } = await supabaseAdmin.from("report_products")
      .select("id, title, tagline, price_cents, currency, is_free, is_published, stripe_price_id, stripe_product_id")
      .eq("id", bundle.id).maybeSingle();
    if (error) throw new Error("We couldn't verify this set. Please try again.");
    if (!product?.is_published || product.is_free || product.price_cents !== pricing.priceCents) {
      throw new Error("This gift set is not configured for checkout yet. Individual reports remain available.");
    }
    const stripe = getStripe();
    const priceId = await ensureStripePrice(stripe, product);
    const origin = checkoutOrigin(getRequest().url, process.env.SITE_URL);
    const email =
      typeof (context.claims as { email?: unknown }).email === "string"
        ? ((context.claims as { email?: string }).email as string)
        : undefined;

    const anchor = bundle.reportIds[0];
    if (!anchor) throw new Error("This bundle is empty.");

    let session;
    try {
      session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price: priceId }],
      customer_email: email,
      client_reference_id: context.userId,
      metadata: {
        user_id: context.userId,
        bundle_id: bundle.id,
        report_id: anchor,
        report_ids: bundle.reportIds.join(","),
      },
      payment_intent_data: {
        metadata: { user_id: context.userId, bundle_id: bundle.id, report_id: anchor },
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&report=${encodeURIComponent(anchor)}`,
      cancel_url: `${origin}/checkout/cancel?report=${encodeURIComponent(anchor)}`,
    }, { idempotencyKey: checkoutIdempotencyKey(context.userId, "bundle", bundle.id, data.requestId) });
    } catch {
      throw new Error("We couldn’t open secure checkout. Please try again shortly.");
    }
    if (!session.url) throw new Error("Checkout is no longer available. Please try again.");

    const { error: purchaseError } = await supabaseAdmin.from("report_purchases").upsert({
      user_id: context.userId,
      report_id: anchor,
      stripe_session_id: session.id,
      amount_cents: pricing.priceCents,
      currency: "usd",
      status: "pending",
      customer_email: email ?? null,
      metadata: { bundle_id: bundle.id, report_ids: bundle.reportIds } as never,
    }, { onConflict: "stripe_session_id", ignoreDuplicates: true });
    if (purchaseError) throw new Error("We couldn’t save your checkout. Please retry; your checkout will be reused.");

    return { alreadyOwned: false, url: session.url };
  });
