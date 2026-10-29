# Audit: Monica Meleski's reports (read-only)

## Current status: blocked on database access
- The database read tool returned "Database is possibly not accessible at the moment" (checked 10:37 UTC today).
- Direct database access from the shell also failed: the database login was not found.
- I retried at 10:43 UTC and got the same error.
- No code or data was changed.

## What the audit can and cannot show
I confirmed in the code that generating a report saves no record of it: no title, date or price. Reports are written on demand and downloaded as PDFs. There is also no price history, so a "price at the time it was generated" can't be recovered; only today's catalog price is available. "Reports Monica generated" can only be rebuilt from these records (purchases, unlocks, emailed reports, admin actions):

| Table | Fields that matter |
|---|---|
| auth.users | id, email (to find Monica's account) |
| report_purchases | report_id, status, amount_cents, currency, created_at, stripe_session_id, metadata |
| report_entitlements | report_id, status, source (purchase / admin grant), granted_at, granted_by, purchase_id, note |
| email_send_log | recipient_email, template_name, status, created_at, pdf_url, metadata (report emails sent) |
| admin_audit_log | action, target_email, target_report_id, created_at, metadata |
| report_products | id, title, price_cents, currency, is_free, is_published, stripe_price_id, stripe_product_id |
| user_roles | role (to check whether Monica is an admin, so generations would leave no purchase record) |

## Steps once the database responds
1. Find Monica's account by email (try `%meleski%` in case the address differs).
2. Pull her purchases, unlocked reports, report emails and admin log entries; merge them into one list by report with date, status and source.
3. Match each report to `report_products` for its standard price and Stripe price.
4. Add up standard prices only for reports with a real, non-zero price and a Stripe price. Flag every report with no price, a $0 price, a "free" flag, or no matching product, and leave it out of the total.
5. Report any reports she generated that left no record (for example if she is an admin), as unknowable.

## Pricing caveat known now
Earlier checks found that the catalog rows may hold $0 prices and no Stripe price links. The built-in price tiers in the code ($14–$99) were never confirmed as real prices, so they won't be used. If the rows are still $0, the total will show as blocked rather than as an estimate.

## What I need from you
Retry once the backend is reachable. If it stays unavailable, export `report_purchases`, `report_entitlements`, `email_send_log` and `report_products` as CSV and attach them here, and I'll do the audit from those files.
