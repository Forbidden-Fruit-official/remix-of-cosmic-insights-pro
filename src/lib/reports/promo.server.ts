// "SPOOKY SAVINGS" promotion. Stripe promotion codes cannot contain spaces,
// so the customer-facing code is SPOOKYSAVINGS and the coupon's display name
// is "SPOOKY SAVINGS". Nothing is created until an admin runs ensureSpookyPromo.
import type Stripe from "stripe";

export const SPOOKY_COUPON_ID = "spooky-savings-50";
export const SPOOKY_COUPON_NAME = "SPOOKY SAVINGS";
export const SPOOKY_CODE = "SPOOKYSAVINGS";
export const SPOOKY_PERCENT_OFF = 50;

export async function findActiveSpookyPromo(stripe: Stripe) {
  const list = await stripe.promotionCodes.list({ code: SPOOKY_CODE, active: true, limit: 1 });
  return list.data[0] ?? null;
}

/**
 * Checkout params: always show Stripe's promo-code field so customers can
 * enter any active code (SPOOKYSAVINGS, MONICA2REPORTS, ...). Stripe validates
 * the code, its redemption limit and product restrictions server-side.
 * Pre-applying a discount would hide this field (Stripe forbids both).
 */
export async function promoCheckoutParams(
  _stripe?: Stripe,
): Promise<{ allow_promotion_codes: true }> {
  return { allow_promotion_codes: true };
}

/** Idempotent: reuses the coupon and code if they already exist. */
export async function ensureSpookyPromo(stripe: Stripe) {
  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(SPOOKY_COUPON_ID);
  } catch {
    coupon = await stripe.coupons.create(
      { id: SPOOKY_COUPON_ID, name: SPOOKY_COUPON_NAME, percent_off: SPOOKY_PERCENT_OFF, duration: "once" },
      { idempotencyKey: `coupon-${SPOOKY_COUPON_ID}` },
    );
  }
  const existing = await findActiveSpookyPromo(stripe);
  const promo =
    existing ??
    (await stripe.promotionCodes.create(
      { coupon: coupon.id, code: SPOOKY_CODE } as unknown as Stripe.PromotionCodeCreateParams,
      { idempotencyKey: `promo-${SPOOKY_CODE}` },
    ));
  return { couponId: coupon.id, promotionCodeId: promo.id, code: SPOOKY_CODE, percentOff: coupon.percent_off };
}

/** A completed session should unlock reports when paid, or fully discounted (100% off code). */
export function isSessionFulfillable(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}
