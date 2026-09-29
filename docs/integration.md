# Composio integration reference

Inspected on 2026-09-29: `@composio/core` 0.22.0 and `@composio/vercel` 0.12.1. The Vercel provider supports AI SDK 7. Provider tools are wrapped with `VercelProvider.wrapTool()` and executed through the persistent session after ledger checks. The agent cannot call an unguarded Composio multi-execute tool.

`lib/composio.ts` contains the `instant` session configuration, explicit Instant account selection, and parsing of `instantCharge`. The old `premiumUsage`/`premium_usage` names are not aliases. Wallet and Keys toolkits share one session. Key calls explicitly select the user's connected account. Wallet calls explicitly select `instant_account` so user-provider connections cannot mask missing Instant access.

## Tool catalog

These slugs were discovered with the authenticated Composio CLI and their input schemas inspected. **Instant availability for the app's project remains unverified** until `pnpm discover` or in-app SDK discovery succeeds. The app intersects the live session's `instantAccount.allowedToolSlugs` with its allowlist and confirmed rates.

| Role | Toolkit | Tools | Route |
| --- | --- | --- | --- |
| Web/company/funding search | Exa | `EXA_SEARCH` | Wallet candidate; `auto`, at most 10 results, no paid content extras |
| Company filtering | Apollo | `APOLLO_ORGANIZATION_SEARCH` | Wallet candidate |
| Team/about/careers pages | Firecrawl | `FIRECRAWL_SCRAPE` | Wallet candidate; synchronous markdown only |
| Decision makers | Apollo | `APOLLO_PEOPLE_SEARCH` | Wallet candidate; qualified domain only |
| Business email discovery | Hunter | `HUNTER_DOMAIN_SEARCH` | Wallet candidate; qualified domain only |
| Email verification | ZeroBounce | `ZEROBOUNCE_VALIDATE_EMAIL` | Wallet candidate |
| Verification fallback | Hunter | `HUNTER_EMAIL_VERIFIER` | Wallet candidate |
| CRM exclusion | HubSpot | `HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA`, `HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA` | Keys |
| Alternative CRM | Salesforce | `SALESFORCE_EXECUTE_SOSL_SEARCH` | Keys |
| Prior contact exclusion | Gmail | `GMAIL_FETCH_EMAILS` | Keys |
| Approved draft creation | Gmail | `GMAIL_CREATE_EMAIL_DRAFT` | Keys |

Parallel's discovered `PARALLEL_SEARCH` schema exposed `search_queries` only, with no `mode` field. It is excluded until hosted fast-mode behavior can be confirmed. Exa is the provisional search fallback, not a claim of live Instant coverage. Hiring and funding use company pages and Exa; PredictLeads was discovered but not enabled without verified coverage and prices. Apollo people enrichment was not added because the needed input schema and rate were not confirmed. Hunter domain search supplies discoverable business addresses when available. No asynchronous research tools are enabled.

## Confirmed maximum rates

`config/instant-rates.json` deliberately starts empty. Each enabled tool needs a maximum USD charge for **all input combinations permitted by `lib/catalog.ts`**, not a guessed average or the provider's retail price. A confirmation from Composio must specify the eligible tool, input limits, and rate ceiling.

The file has this shape (placeholders are not usable values):

```json
{
  "verifiedAt": "<ISO timestamp>",
  "expiresAt": "<ISO timestamp>",
  "source": "<confirmation reference>",
  "tools": {
    "EXA_SEARCH": { "maxUsd": "<confirmed decimal USD maximum>" }
  }
}
```

A missing or expired confirmation disables the tool. Runtime search independently verifies Instant coverage. Rebuild after updating this server configuration.

## Known deployment requirements

The original brief listed two service keys. Durable Vercel enforcement additionally requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Local development uses Node's built-in SQLite, with no database service account. Neither environment needs Exa, Apollo, Firecrawl, Hunter, ZeroBounce, Gmail, or CRM API keys.

Email exclusion checks are cached during a run. Draft creation stops when its screening evidence is more than 30 minutes old. Start a fresh browser session rather than reuse stale evidence. Interrupted writes require checking the Composio log and Gmail before any manual retry; the app does not automatically replay them.

## Sources

- [Composio Instant Tools](https://docs.composio.dev/docs/instant-tools)
- [Composio Vercel provider](https://docs.composio.dev/docs/providers/vercel)
- [Composio sessions](https://docs.composio.dev/docs/sessions)
- [HubSpot CRM search](https://developers.hubspot.com/blog/when-to-use-crm-search-api-vs.-object-specific-apis)
