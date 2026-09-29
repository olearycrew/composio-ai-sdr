import { randomUUID } from "node:crypto"
import { z } from "zod"
import { demoUser, jsonBody, sameOrigin, rateLimit } from "@/lib/http"
import { read, update } from "@/lib/store"
import { getRun } from "@/lib/ledger"
import { newRun, type Run } from "@/lib/sdr"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const setup = () => ({
  composio: !!process.env.COMPOSIO_API_KEY,
  gateway: !!process.env.AI_GATEWAY_API_KEY || !!process.env.VERCEL,
})
export async function GET(req: Request) {
  try {
    const userId = await demoUser()
    const id = await read<string>(`user:${userId}`)
    const run = id ? await getRun(id) : null
    return Response.json(
      {
        run: run
          ? {
              ...run,
              messages: new URL(req.url).searchParams.has("history")
                ? run.messages
                : [],
              catalog: run.catalog.map((c) => ({ ...c, schema: {} })),
              calls: run.calls.map((c) => ({
                ...c,
                args: {},
                result: undefined,
              })),
            }
          : null,
        setup: setup(),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return Response.json(
      { error: "The run store is unavailable. Check storage configuration." },
      { status: 503 }
    )
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req)
    const userId = await demoUser()
    if (!(await rateLimit(req, userId)))
      return Response.json(
        { error: "Please wait a minute before starting another request." },
        { status: 429 }
      )
    const { brief } = z
      .object({ brief: z.string().min(20).max(8000) })
      .parse(await jsonBody(req))
    const id = await update<string, string>(`user:${userId}`, (prior) => ({
      state: prior ?? randomUUID(),
      result: prior ?? "",
    }))
    const runId = id || (await read<string>(`user:${userId}`))!
    const run = await update<Run, Run>(`run:${runId}`, (prior) => {
      const run = prior ?? newRun(runId, userId, brief)
      return { state: run, result: run }
    })
    return Response.json({ run, setup: setup() })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start the run",
      },
      { status: 400 }
    )
  }
}
