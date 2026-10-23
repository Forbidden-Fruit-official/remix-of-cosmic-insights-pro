import { describe, expect, it } from "vitest";
import { isSessionFulfillable, promoCheckoutParams } from "./promo.server";

describe("checkout promotion codes", () => {
  it("always lets customers enter a promo code like MONICA2REPORTS", async () => {
    const params = await promoCheckoutParams();
    expect(params).toEqual({ allow_promotion_codes: true });
    expect("discounts" in params).toBe(false);
  });

  it("unlocks a 100%-off checkout (no payment required)", () => {
    expect(isSessionFulfillable("no_payment_required")).toBe(true);
  });

  it("unlocks a paid checkout", () => {
    expect(isSessionFulfillable("paid")).toBe(true);
  });

  it("does not unlock an unpaid checkout", () => {
    expect(isSessionFulfillable("unpaid")).toBe(false);
  });
});
