import { mkdir, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { newRun, LAUNCH_BRIEF, type Run } from "../lib/sdr"
import { read, update } from "../lib/store"
import { discover } from "../lib/composio"
import { getRun } from "../lib/ledger"
if (!process.env.COMPOSIO_API_KEY)
  throw new Error("Set COMPOSIO_API_KEY in .env.local before SDK discovery.")
// Reuse a dedicated discovery user/session, and do not execute paid provider tools.
let id = await read<string>("discovery-run")
if (!id) {
  id = randomUUID()
  await update("discovery-run", () => ({ state: id!, result: undefined }))
  await update<Run, void>(`run:${id}`, () => ({
    state: newRun(id!, "sdr-catalog-discovery", LAUNCH_BRIEF),
    result: undefined,
  }))
}
await discover(id)
const run = await getRun(id)
await mkdir("artifacts/live", { recursive: true })
await writeFile(
  "artifacts/live/catalog.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      sdk: "0.22.0",
      catalog: run.catalog,
    },
    null,
    2
  )
)
console.table(
  run.catalog.map((t) => ({
    tool: t.slug,
    instant: t.instant,
    maxUsd: t.maxCharge === null ? "UNCONFIRMED" : t.maxCharge / 1e6,
  }))
)
