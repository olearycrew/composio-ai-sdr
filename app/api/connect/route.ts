import { z } from "zod"
import { demoUser, sameOrigin, jsonBody, rateLimit } from "@/lib/http"
import { getRun } from "@/lib/ledger"
import { connect, refreshConnections } from "@/lib/composio"
export async function POST(req: Request) {
  try {
    sameOrigin(req)
    const userId = await demoUser()
    if (!(await rateLimit(req, userId)))
      return Response.json({ error: "Please wait a minute." }, { status: 429 })
    const { runId, toolkit } = z
      .object({
        runId: z.uuid(),
        toolkit: z.enum(["gmail", "hubspot", "salesforce"]).optional(),
      })
      .parse(await jsonBody(req))
    const run = await getRun(runId)
    if (run.userId !== userId)
      return Response.json({ error: "Run not found" }, { status: 404 })
    return Response.json(
      toolkit ? await connect(runId, toolkit) : await refreshConnections(runId)
    )
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not connect app",
      },
      { status: 400 }
    )
  }
}
