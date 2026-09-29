# Launch acceptance checklist

The live launch run is **not yet verified**. Passing local safety tests does not establish provider availability, CRM/Gmail access, actual charges, or delivery of Gmail drafts.

Use the exact launch brief from `lib/sdr.ts`. Record the run ID, timestamp, SDK version, live catalog snapshot, confirmed-rate reference, and screenshots without credentials. Keep raw prospect data and provider logs in ignored `artifacts/live/`.

1. Verify the template fork and retained license.
2. Run SDK discovery with the intended project's key. Confirm the project enables Instant and every selected wallet slug appears in the session's allowed Instant tools. Record substitutions.
3. Confirm maximum charges for the app's bounded inputs and configure unexpired rates.
4. Connect the intended Gmail account and HubSpot or Salesforce. Verify reconnect-and-continue uses the same session.
5. Run the brief. Confirm a visible plan precedes every wallet call and actual charges are returned.
6. Confirm 20 accepted prospects, or record the exact budget, verification, coverage, or fit reason for fewer. Inspect their US location, 10–50 headcount, agency focus, role, finance-team assessment, and dated growth evidence.
7. Inspect each accepted prospect's successful deliverable-email verification and clear company/contact CRM plus sent-mail searches. Confirm known seeded customer/past-contact controls are excluded.
8. Confirm the first five email previews are pending in `ask_user`. Before approval, there must be no Gmail draft writes. Edit, approve, and reject separate previews; verify only the approved versions exist in Gmail drafts. Do not send them.
9. Sum actual per-call charges and compare with the spend panel, provider totals, and step totals. Confirm total research spend is below $25 and reservations plus spend never exceed the budget. Confirm cached calls add no spend.
10. Exercise insufficient-credit, provider failure, missing-charge, duplicate-click, concurrent-request, and target-reached cases. Inspect the top-up link and final reason.
11. Verify the chat, tool badges/costs, results, approval controls, and finished state at 1280×720. Inspect keyboard controls and a narrow viewport.
12. Run tests, type checking, lint, production build, and a secret scan. Verify the deployment's durable storage and persisted rate limit across instances.

Unresolved dependencies: `COMPOSIO_API_KEY`, `AI_GATEWAY_API_KEY`, project Instant enablement and confirmed rates, Gmail/CRM connections, and Redis configuration for a Vercel deployment.

## Local evidence (2026-09-29)

Ten named safety tests pass. Type checking and lint pass. The production webpack build passes. Browser/API checks at 1280×720 and 390×844 verify navigation, overflow, ownership, cross-origin rejection, HTTP 429, and the approval-edit flow. The review/results screenshots use intercepted fixture data, not live prospects or live Gmail writes. No research credits have been spent by these tests.
