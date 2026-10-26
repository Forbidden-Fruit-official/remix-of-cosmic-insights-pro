import Stripe from "stripe";

export function stripeSecret(): string {
  // The project secret was originally saved under a misspelled name; support both.
  const key =
    process.env.STRIPE_SECRET_KEY ??
    process.env.SRIPE_API_SECTRET_KEY ??
    process.env.STRIPE_API_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured: missing STRIPE_SECRET_KEY.");
  return key;
}

export function stripeWebhookSecret(): string {
  const key = process.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK;
  if (!key) throw new Error("Stripe webhook secret is not configured.");
  return key;
}

export function getStripe(): Stripe {
  return new Stripe(stripeSecret(), {
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
    timeout: 20_000,
    maxNetworkRetries: 1,
  });
}

export interface CatalogRow {
  id: string;
  title: string;
  tagline: string;
  price_cents: number;
  currency: string;
  is_free: boolean;
  is_published: boolean;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
}

/** Read-only validation: checkout must never create or replace catalog prices. */
export async function ensureStripePrice(stripe: Stripe, row: CatalogRow): Promise<string> {
  if (!row.stripe_price_id) {
    throw new Error("This report is not ready for checkout yet. Please contact us before purchasing.");
  }
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(row.stripe_price_id);
  } catch {
    throw new Error("We couldn't verify this report's price. Please try again shortly.");
  }
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  if (!price.active || price.type !== "one_time" || price.unit_amount !== row.price_cents ||
      price.currency !== row.currency.toLowerCase() ||
      (row.stripe_product_id && row.stripe_product_id !== productId)) {
    throw new Error("This report's checkout price needs review. No payment has been started.");
  }
  return price.id;
}
