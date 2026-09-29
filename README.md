# Composio AI SDR

Turn a sales brief into researched prospects and reviewed Gmail drafts. **Keys** are your connected CRM and Gmail. The **Wallet** pays for eligible Composio Instant research calls. Every provider call has a source badge, status, and charge. There is no email-sending path.

Based on [shadcn-ui/chatbot-template](https://github.com/shadcn-ui/chatbot-template), with Next.js 16, AI SDK 7, shadcn/ui, the Vercel AI Gateway, and the Composio TypeScript SDK.

> Live launch validation is pending. The code does not include fabricated Instant prices or pretend that ordinary toolkit availability proves Instant access. Research remains disabled until project-specific coverage and maximum charges are confirmed. See [integration status](docs/integration.md).

## Run locally

1. Install Node.js 24 and pnpm.
2. Clone this repository and install dependencies:

   ```sh
   pnpm install
   cp .env.example .env.local
   ```

3. Set `COMPOSIO_API_KEY` and `AI_GATEWAY_API_KEY` in `.env.local`. Do not add provider keys. Ask Composio to enable Instant for the project and confirm supported tools and maximum rates.
4. Add confirmed rates to `config/instant-rates.json` as described in [the integration reference](docs/integration.md). Run SDK discovery:

   ```sh
   pnpm discover
   ```

   This lists live tool schemas and session Instant coverage without executing research calls. Private results go to ignored `artifacts/live/catalog.json`.
5. Start the app:

   ```sh
   pnpm dev
   ```

6. Open `http://localhost:3000`, select the launch brief, and connect Gmail plus HubSpot or Salesforce through the chat. Select **Continue** after connecting. The anonymous demo identity and one Composio session persist across turns in that browser.
7. Review the proposed emails. Edit the subject or body, then select **Approve & create draft** or **Reject**. Only the approved version is written to Gmail. Nothing is sent.

SQLite persists local budgets, messages, calls, and approvals in `.sdr/`. This directory contains private prospect data and is ignored by Git.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Folearycrew%2Fcomposio-ai-sdr%2Ftree%2Fai-sdr&project-name=composio-ai-sdr&repository-name=composio-ai-sdr&env=COMPOSIO_API_KEY,AI_GATEWAY_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

Set the deployment to Node.js 24. Connect an Upstash Redis database from the Vercel Marketplace and provide its REST URL and token. Redis stores the shared ledger, cache, approvals, and rate limits across serverless instances. On Vercel, the app refuses to use temporary local storage. The database credentials are infrastructure credentials, not research-provider keys.

Provide the Composio and Gateway environment variables, configure confirmed rates, and redeploy. Vercel Gateway OIDC also works when `AI_GATEWAY_API_KEY` is omitted. Follow the same connection and review flow as local development.

## Use your own brief

In a fresh browser session, enter your audience, qualification rules, offer, prospect count, and research budget in the chat instead of selecting the launch brief. For example:

> Find 10 founders at US design agencies with 10–30 employees that are hiring. Offer a 20-minute bookkeeping consultation. Exclude CRM contacts and anyone already contacted in Gmail. Show the first five emails. Spend up to $10 on research.

The budget defaults to $5. This demo supports 1–100 prospects and budgets up to $100. The original brief and budget remain fixed during a run; later chat messages cannot increase its spending limit. One run is retained per anonymous browser identity. Use a separate browser profile for a different brief or CRM identity.

## Research and review

The agent discovers tools, publishes a priced call plan, finds companies, reads qualification evidence, finds decision makers, verifies shortlisted addresses, checks CRM records and sent mail, then presents outreach in `ask_user`.

All matching CRM records are excluded, which is stricter than excluding only customer lifecycle stages. Gmail checks include recipient, cc, bcc, and domain matches, including trashed sent messages. Missing, failed, or unrecognized exclusion responses withhold the prospect. Catch-all and unknown email-verification results do not qualify.

Company and person evidence includes a source URL, a verbatim quote, and the successful call that supplied it. Claims about company fit still require the model to interpret the evidence; a missing finance-team listing is not proof that a company has no finance staff.

The app pauses after a bounded agent turn. **Continue** resumes the saved run. This avoids background jobs. Email previews are in-app proposals; Gmail drafts exist only after approval.

## Budget behavior

All ledger values use integer microdollars. Before a wallet call, the server checks the published plan, Instant coverage, current rate confirmation, target count, cache, and remaining budget. It atomically reserves the configured maximum charge. After the call, it records `instantCharge` and releases the unused reservation.

The spend panel sums the same per-call ledger values shown on tool cards. It also displays pending reservations, totals by provider, and totals by step. Prospect costs include attributable company research divided among that company's accepted prospects; shared discovery and rejected-company costs stay in the total.

Identical tool/input calls are cached, including failures and pending calls. Explicit unbilled failures show $0. Interrupted calls, missing charges, or charges exceeding the confirmed maximum pause further spending and retain unresolved reservations. They are not automatically retried. A billed failure is flagged for reconciliation rather than hidden as $0. Strict budget enforcement depends on Composio honoring its confirmed maximum rates.

The inspected SDK exposes usage totals but no documented wallet-balance endpoint. The panel labels the balance unavailable and links to Composio billing. Model generation charges from the AI Gateway are separate from the research budget.

## Security and verification

`/api/chat` uses persisted limits of 15 requests per minute per demo user and client IP, plus a 60-request global limit. Write endpoints apply the same limits. The server retains canonical conversation history, validates new user text, and ignores client-supplied assistant/tool history. An HttpOnly SameSite cookie scopes runs and approvals. Shared storage atomically serializes budget reservations; concurrent chat requests for the same run are rejected.

This is an anonymous demo, not multi-user authentication. Set an AI Gateway spend limit and protect a private deployment before connecting sensitive accounts. Composio session tool filters include only the listed research, CRM-read, Gmail-read, and Gmail-draft tools; they include no send, proxy, or workbench tool.

Run checks:

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
# With the app running and Chromium installed:
pnpm test:browser
```

The safety tests exercise money parsing, concurrent reservations, caching, unresolved charges, exclusion failures, verification, evidence binding, approval ownership/edits/replays, search caps, and the tool allowlist. They do not substitute for a live launch run. See the [launch acceptance checklist](docs/acceptance.md).

## License

MIT. The upstream template license is retained.
