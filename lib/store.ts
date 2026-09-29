import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { Redis } from "@upstash/redis"

// Local development uses SQLite; Vercel uses shared Redis and atomic CAS.
let sqlite: DatabaseSync | undefined
let redis: Redis | undefined
function remote() {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return (redis ??= Redis.fromEnv({ automaticDeserialization: false }))
  }
  if (process.env.VERCEL)
    throw new Error(
      "Connect Upstash Redis before deploying: the budget ledger requires durable shared storage."
    )
  return undefined
}
function local() {
  if (!sqlite) {
    const dir = process.env.SDR_DATA_DIR ?? join(process.cwd(), ".sdr")
    mkdirSync(dir, { recursive: true })
    sqlite = new DatabaseSync(join(dir, "state.sqlite"))
    sqlite.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )
  }
  return sqlite
}
export async function read<T>(key: string): Promise<T | null> {
  const r = remote()
  const raw = r
    ? await r.get<string>(`sdr:${key}`)
    : (
        local().prepare("SELECT value FROM state WHERE key = ?").get(key) as
          { value: string } | undefined
      )?.value
  return raw ? (JSON.parse(raw) as T) : null
}
export async function update<T, R>(
  key: string,
  change: (state: T | null) => { state: T; result: R }
): Promise<R> {
  const r = remote()
  if (r) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const before = await r.get<string>(`sdr:${key}`)
      const { state, result } = change(
        before ? (JSON.parse(before) as T) : null
      )
      const ok = await r.eval(
        "local v=redis.call('GET',KEYS[1]); if (v or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1",
        [`sdr:${key}`],
        [before ?? "", JSON.stringify(state)]
      )
      if (ok === 1) return result
    }
    throw new Error("Another request is updating this run. Try again.")
  }
  const db = local()
  db.exec("BEGIN IMMEDIATE")
  try {
    const row = db.prepare("SELECT value FROM state WHERE key = ?").get(key) as
      { value: string } | undefined
    const { state, result } = change(row ? (JSON.parse(row.value) as T) : null)
    db.prepare(
      "INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(key, JSON.stringify(state))
    db.exec("COMMIT")
    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
