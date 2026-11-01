# Live checkout incident: diagnosis and repair plan (read-only so far)

## Findings (checked 1 Nov, 11:2x UTC; nothing changed)
1. **The live site is not this project.** mycosmicblueprint.online redirects (301) to yourcosmicblueprint.lovable.app. This project has never been published; its own address is cosmic-celestial-insight.lovable.app. The live site runs a different project's code.
2. **The error text isn't in this project.** "not configured for a secured checkout" appears nowhere in this code. This project's checkout errors are different ("This report is not ready for checkout yet", "PRICE_PENDING…"). The live site's code also shows older wording, such as "Report AI is not configured. Set GEMINI_API_KEY…", which this project doesn't have.
3. **I can't open the live project.** No project in your workspace that I can access matches yourcosmicblueprint, so I couldn't read its code, its catalog or its Stripe links.
4. **This project couldn't take payments yet either, even if published:**
   - `STRIPE_SECRET_KEY` is set but holds a placeholder, not a real key (names present: SITE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK).
   - Catalog rows are reported as $0 / free with no Stripe price links. `createReportCheckout` (src/lib/reports/checkout.functions.ts, about line 35) rejects them with PRICE_PENDING, and `ensureStripePrice` (src/lib/reports/stripe.server.ts, line 42) rejects any row without a Stripe price.
   - The database is unreachable from here, so I couldn't list each report's setup.

**Likely root cause:** the live project's catalog has no Stripe price set for any report, which is the same state as the 193-row spreadsheet (all $0, no Stripe IDs). I can't confirm this until I can read that project or the shared database.

## Safest repair plan (each step needs your go-ahead)
1. **Identify the live project:** tell me its name, or share it with this workspace. I'll check it out read-only and find the exact line that shows the error.
2. **Decide which project should be live.** Option A: fix the existing live project. Option B: publish this project and move the domain to it. Option B also needs a real Stripe key and confirmed prices.
3. **Set the prices:** you supply real prices and existing Stripe price IDs per report. I'll link them to the catalog without creating or changing anything in Stripe. Reports with no confirmed price stay "Price coming soon".
4. Admin free access and the purchase-unlock rules stay as they are.

## Verification plan
- A script, run as a non-admin test account, tries to start checkout for every published report. It records which ones open a Stripe page, then stops without paying.
- Do one real low-value or 100%-off test purchase. Confirm the report unlocks only after Stripe confirms payment, and that it appears in My Reports.
- Confirm an admin still opens every report free.

## Automated pre-publish check (recommended)
- A test that fails if any published, non-free report has a $0 price or no Stripe price ID.
- An admin "checkout readiness" check that asks Stripe, read-only, whether each linked price is active, one-time and the same amount as the catalog.
- A warning if the live domain points to a different project than the one being published.

## Still open: Monica audit
Blocked: the database can't be reached, and generated reports aren't saved. Only purchases, unlocks, emails and admin actions can be counted, at today's catalog prices.

## What I need from you
- The name of the project behind yourcosmicblueprint.lovable.app, or access to it.
- Which project should be live.
- A real Stripe key and confirmed prices, if this project goes live.
