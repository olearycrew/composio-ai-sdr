import { z } from "zod"
import { mutateRun } from "./ledger"
export const reviewSchema = z.object({
  runId: z.uuid(),
  proposalId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(5000),
})
export async function saveReview(
  userId: string,
  input: z.infer<typeof reviewSchema>
) {
  return mutateRun(input.runId, (state) => {
    if (state.userId !== userId) throw new Error("Run not found")
    const proposal = state.proposals.find((p) => p.id === input.proposalId)
    if (!proposal || proposal.status !== "pending")
      throw new Error("This email has already been reviewed")
    proposal.subject = input.subject
    proposal.body = input.body
    proposal.status = input.decision === "approve" ? "approved" : "rejected"
    return proposal
  })
}
