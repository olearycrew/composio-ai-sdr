import { reviewSchema, saveReview } from "@/lib/approval"
import { demoUser, sameOrigin, jsonBody, rateLimit } from "@/lib/http"
import { getRun, mutateRun } from "@/lib/ledger"
import { createDraft } from "@/lib/prospects"
export const maxDuration = 300
export async function POST(req: Request) {
  try {
    sameOrigin(req)
    const userId = await demoUser()
    if (!(await rateLimit(req, userId)))
      return Response.json({ error: "Please wait a minute." }, { status: 429 })
    const input = reviewSchema.parse(await jsonBody(req))
    const run = await getRun(input.runId)
    if (run.userId !== userId)
      return Response.json({ error: "Run not found" }, { status: 404 })
    await saveReview(userId, input)
    const call =
      input.decision === "approve"
        ? await createDraft(run.id, input.proposalId)
        : undefined
    await mutateRun(run.id, (state) => {
      if (
        state.proposals.every((p) => ["drafted", "rejected"].includes(p.status))
      )
        state.status = "complete"
    })
    return Response.json({ ok: !call || call.status === "succeeded", call })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Review could not be saved",
      },
      { status: 400 }
    )
  }
}
